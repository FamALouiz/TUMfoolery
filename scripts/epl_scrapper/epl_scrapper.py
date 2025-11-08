#!/usr/bin/env python3
"""
EPL historic odds crawler (no The Odds API required)

Sources
- Football-Data.co.uk CSV (FREE): opening + closing odds back to 2000/01.
  Notes: columns with trailing 'C' are closing odds (e.g., B365CH, PSCH...).  # docs: football-data notes
- API-Football (optional): pre-match odds per fixture if APIFOOTBALL_KEY is set.

Outputs:
  data/odds_timeseries.parquet  - tidy odds rows (with implied + de-vig)
  data/odds_timeseries.csv      - optional CSV
  data/lstm_sequences.npz       - X,y for next-step prediction (per bookmaker)

ENV:
  APIFOOTBALL_KEY=<api_football_key>  (optional; enables API-Football pulls)

Usage examples
  # Free, long-run history from Football-Data CSV (2016/17..2024/25)
  python historic_epl_odds.py --source fdata --start 2016-08-01 --end 2025-06-30 --save-csv

  # Try API-Football for season 2023/24 (league=39 = EPL)
  python historic_epl_odds.py --source apifootball --start 2023-08-01 --end 2024-06-01 --save-csv
"""

import os
import io
import time
import sys
import argparse
import re
from datetime import datetime, timedelta, timezone
from dateutil import parser as dtparse
from typing import List, Dict, Any, Optional
import requests
import numpy as np
import pandas as pd

# -------------------- helpers


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def to_dt(s: str) -> datetime:
    return dtparse.isoparse(s).astimezone(timezone.utc)


def rate_limit_sleep(seconds=0.5):
    time.sleep(seconds)


def season_code(year_start: int) -> str:
    y1 = str(year_start % 100).zfill(2)
    y2 = str((year_start + 1) % 100).zfill(2)
    return f"{y1}{y2}"


def seasons_covering_range(date_from: datetime, date_to: datetime) -> List[int]:
    # include both year_of_start and possible previous year to cover Aug-May crossover
    ys = set()
    y = date_from.year - 1
    while y <= date_to.year:
        ys.add(y)
        y += 1
    return sorted(ys)


def safe_float(x):
    try:
        return float(x) if x is not None and x != "" else None
    except:
        return None

# -------------------- Football-Data.co.uk (FREE CSVs)


FD_BASE = "https://www.football-data.co.uk/mmz4281"
EPL_FILE = "E0.csv"  # Premier League


def load_fdata_season(year_start: int) -> Optional[pd.DataFrame]:
    url = f"{FD_BASE}/{season_code(year_start)}/{EPL_FILE}"
    r = requests.get(url, timeout=30)
    if r.status_code != 200:
        return None
    df = pd.read_csv(io.StringIO(r.text))
    df["SeasonStart"] = year_start
    # Date can be in different formats across seasons; coerce with dayfirst
    if "Date" in df.columns:
        df["Date"] = pd.to_datetime(
            df["Date"], dayfirst=True, errors="coerce", utc=True)
    return df


def list_bookmaker_prefixes(df: pd.DataFrame) -> List[str]:
    # detect prefixes that have H/D/A columns (e.g., B365H,D,A ; B365CH,CD,CA)
    cols = set(df.columns)
    prefixes = []
    for c in cols:
        if len(c) >= 2 and c.endswith("H"):
            pref = c[:-1]
            if (pref+"D") in cols and (pref+"A") in cols:
                prefixes.append(pref)
    return sorted(prefixes)


def tidy_from_fdata(df_all: pd.DataFrame, start: datetime, end: datetime) -> pd.DataFrame:
    df = df_all.copy()
    # Basic columns may vary by season; guard
    keep_cols = [c for c in ["SeasonStart", "Date", "HomeTeam",
                             "AwayTeam", "FTHG", "FTAG", "FTR"] if c in df.columns]
    df = df[keep_cols +
            [c for c in df.columns if re.match(r".*[HDA]$", c)]].copy()

    df = df[(df["Date"].notna()) & (df["Date"] >= pd.Timestamp(start))
            & (df["Date"] <= pd.Timestamp(end))]
    prefixes = list_bookmaker_prefixes(df)

    rows = []
    for _, r in df.iterrows():
        match_dt = r["Date"].to_pydatetime()
        commence_time = iso(match_dt)  # no exact kickoff time in CSV
        for pref in prefixes:
            h, d, a = safe_float(
                r.get(pref+"H")), safe_float(r.get(pref+"D")), safe_float(r.get(pref+"A"))
            if h is None or d is None or a is None:
                continue
            phase = "close" if pref.endswith("C") else "open"
            # e.g., B365, B365C, PS, PSC, AVG, AVGC, MAX, MAXC ...
            bookmaker = pref
            # approximate snapshot_time for ordering (open before close)
            snap_time = match_dt - \
                (timedelta(hours=1) if phase == "close" else timedelta(hours=24))

            base = {
                "snapshot_time": iso(snap_time),
                "commence_time": commence_time,
                "event_key": f"{r.get('SeasonStart')}-{r.get('HomeTeam')}-{r.get('AwayTeam')}-{match_dt.date()}",
                "home": r.get("HomeTeam"),
                "away": r.get("AwayTeam"),
                "bookmaker": bookmaker,
                "market": "h2h",
                "phase": phase,
            }
            rows.append({**base, "side": "home", "point": None, "price": h})
            rows.append({**base, "side": "draw", "point": None, "price": d})
            rows.append({**base, "side": "away", "point": None, "price": a})
    return pd.DataFrame(rows)

# -------------------- API-Football (optional)


APIFOOTBALL = os.environ.get("APIFOOTBALL_KEY")
APIF_BASE = "https://v3.football.api-sports.io"
EPL_LEAGUE_ID = 39  # EPL


def apif_get(path: str, params: Dict[str, Any]) -> dict:
    headers = {"x-apisports-key": APIFOOTBALL}
    resp = requests.get(f"{APIF_BASE}{path}",
                        headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_apif_fixtures(season_year: int) -> pd.DataFrame:
    js = apif_get(
        "/fixtures", {"league": EPL_LEAGUE_ID, "season": season_year})
    rows = []
    for item in js.get("response", []):
        fix = item.get("fixture", {})
        teams = item.get("teams", {})
        rows.append({
            "fixture_id": fix.get("id"),
            "utc_kickoff": fix.get("date"),
            "home": teams.get("home", {}).get("name"),
            "away": teams.get("away", {}).get("name"),
        })
    df = pd.DataFrame(rows)
    if not df.empty:
        df["utc_kickoff"] = pd.to_datetime(df["utc_kickoff"], utc=True)
    return df


def flatten_apif_odds(odds_js: dict) -> List[Dict]:
    rows = []
    for item in odds_js.get("response", []):
        fixture = item.get("fixture", {})
        league = item.get("league", {})
        match_dt = pd.to_datetime(fixture.get(
            "date"), utc=True) if fixture.get("date") else None
        commence_time = iso(match_dt.to_pydatetime()
                            ) if match_dt is not None else None
        for bk in item.get("bookmakers", []):
            bname = bk.get("name") or str(bk.get("id"))
            bupd = bk.get("updated")
            for bet in bk.get("bets", []):
                # look for Match Winner market (common names: "Match Winner", "1X2")
                bet_name = (bet.get("name") or "").lower()
                if "match" in bet_name and "winner" in bet_name or "1x2" in bet_name:
                    # values could be {"value":"Home","odd":"1.75"} or {"value":"1","odd":"1.75"}
                    prices = {"home": None, "draw": None, "away": None}
                    for v in bet.get("values", []):
                        val = (v.get("value") or "").strip().lower()
                        price = safe_float(v.get("odd"))
                        if val in ("home", "1"):
                            prices["home"] = price
                        elif val in ("draw", "x"):
                            prices["draw"] = price
                        elif val in ("away", "2"):
                            prices["away"] = price
                    if all(prices[k] is not None for k in ("home", "draw", "away")):
                        base = {
                            "snapshot_time": bupd or commence_time,
                            "commence_time": commence_time,
                            "event_key": f"{fixture.get('id')}",
                            "home": None, "away": None,  # names not in odds payload always
                            "bookmaker": f"APIF-{bname}",
                            "market": "h2h",
                            "phase": "prematch",
                        }
                        for side, price in prices.items():
                            rows.append(
                                {**base, "side": side, "point": None, "price": price})
    return rows


def fetch_apif_odds_for_season(season_year: int) -> pd.DataFrame:
    # For rate limits, it's cheaper to fetch odds by date pages where available,
    # but we use fixture-based pulls here for clarity.
    fixtures = fetch_apif_fixtures(season_year)
    all_rows = []
    for _, fx in fixtures.iterrows():
        js = apif_get("/odds", {"fixture": int(fx["fixture_id"])})
        rows = flatten_apif_odds(js)
        # backfill team names & kickoff if missing
        for r in rows:
            if not r["home"]:
                r["home"] = fx["home"]
                r["away"] = fx["away"]
            if not r["commence_time"]:
                r["commence_time"] = iso(fx["utc_kickoff"].to_pydatetime())
            if not r["snapshot_time"]:
                r["snapshot_time"] = r["commence_time"]
        all_rows.extend(rows)
        rate_limit_sleep(0.3)
    return pd.DataFrame(all_rows)

# -------------------- features + sequences


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    if "snapshot_time" in df.columns:
        df["snapshot_time"] = pd.to_datetime(
            df["snapshot_time"], utc=True, errors="coerce")
    if "commence_time" in df.columns:
        df["commence_time"] = pd.to_datetime(
            df["commence_time"], utc=True, errors="coerce")
    df["mins_to_kickoff"] = (df["commence_time"] -
                             df["snapshot_time"]).dt.total_seconds() / 60.0
    df["is_pre_match"] = (df["mins_to_kickoff"] >= 0).astype("Int64")
    return df


def implied_prob_decimal(decimal_odds: float) -> Optional[float]:
    if decimal_odds and decimal_odds > 0:
        return 1.0 / decimal_odds
    return None


def devig_h2h(group: pd.DataFrame) -> pd.DataFrame:
    probs = group["price"].apply(implied_prob_decimal)
    s = probs.sum()
    if s and s > 0:
        group["implied"] = probs
        group["devig"] = probs / s
    else:
        group["implied"] = np.nan
        group["devig"] = np.nan
    return group


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["implied"] = np.where(df["price"].notna(), 1.0/df["price"], np.nan)
    mask = df["market"].eq("h2h")
    df.loc[mask, ["implied", "devig"]] = np.nan
    h2h = df[df["market"] == "h2h"].copy()
    if not h2h.empty:
        h2h = h2h.groupby(
            ["event_key", "bookmaker", "snapshot_time"], group_keys=False).apply(devig_h2h)
        df = pd.concat([df.drop(h2h.index), h2h], ignore_index=False)
    return df.reset_index(drop=True)


def build_lstm_sequences(df: pd.DataFrame, lookback=2, by_bookmaker=True, use_devig=True):
    use_col = "devig" if use_devig else "implied"
    d = df[df["market"] == "h2h"].dropna(
        subset=["event_key", "bookmaker", "snapshot_time", "side"]).copy()
    d = d[d["side"].isin(["home", "draw", "away"])]
    if use_col not in d.columns:
        d["devig"] = d["implied"]
    wide = d.pivot_table(index=["event_key", "bookmaker", "snapshot_time"], columns="side",
                         values=use_col, aggfunc="first").reset_index()
    wide = wide.sort_values(["event_key", "bookmaker", "snapshot_time"])
    grp_keys = ["event_key", "bookmaker"] if by_bookmaker else ["event_key"]
    X_list, y_list, meta = [], [], []
    for key, g in wide.groupby(grp_keys):
        g = g.dropna(subset=["home", "draw", "away"])
        arr = g[["home", "draw", "away"]].to_numpy(dtype=np.float32)
        if len(arr) <= lookback:
            continue
        for i in range(lookback, len(arr)):
            X_list.append(arr[i-lookback:i, :])
            y_list.append(arr[i, :])
            meta.append((key, g.iloc[i]["snapshot_time"]))
    if not X_list:
        return None, None, None
    return np.stack(X_list), np.stack(y_list), meta

# -------------------- main


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["fdata", "apifootball"], default="fdata",
                    help="fdata = Football-Data CSV (free); apifootball = API-Football (key required).")
    ap.add_argument("--start", required=True, help="YYYY-MM-DD (UTC)")
    ap.add_argument("--end", required=True, help="YYYY-MM-DD (UTC)")
    ap.add_argument("--save-csv", action="store_true")
    ap.add_argument("--lookback", type=int, default=2,
                    help="LSTM lookback (steps).")
    args = ap.parse_args()

    outdir = "data"
    os.makedirs(outdir, exist_ok=True)
    date_from = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)
    date_to = datetime.fromisoformat(args.end).replace(tzinfo=timezone.utc)

    if args.source == "fdata":
        # pull seasons covering the date range
        seasons = seasons_covering_range(date_from, date_to)
        frames = []
        for y in seasons:
            df = load_fdata_season(y)
            if df is not None:
                frames.append(df)
                print(
                    f"Loaded Football-Data season {y}/{(y+1) % 100:02d} ({len(df)} rows)")
            else:
                print(f"Skip season {y}/{(y+1) % 100:02d} (no file)")
            rate_limit_sleep(0.1)
        if not frames:
            print("No Football-Data seasons loaded.", file=sys.stderr)
            sys.exit(2)
        raw = pd.concat(frames, ignore_index=True)
        tidy = tidy_from_fdata(raw, date_from, date_to)

    else:  # API-Football
        if not APIFOOTBALL:
            print("ERROR: set APIFOOTBALL_KEY for API-Football source.",
                  file=sys.stderr)
            sys.exit(1)
        tidy_frames = []
        for y in range(date_from.year, date_to.year + 1):
            print(f"Fetching API-Football odds for season {y}…")
            df = fetch_apif_odds_for_season(y)
            if not df.empty:
                tidy_frames.append(df)
        if not tidy_frames:
            print("No API-Football odds found.", file=sys.stderr)
            sys.exit(2)
        tidy = pd.concat(tidy_frames, ignore_index=True)
        # filter by date range when commence_time available
        if "commence_time" in tidy.columns:
            tidy["commence_time"] = pd.to_datetime(
                tidy["commence_time"], utc=True, errors="coerce")
            tidy = tidy[tidy["commence_time"].between(pd.Timestamp(
                date_from), pd.Timestamp(date_to), inclusive="both")]

    if tidy.empty:
        print("No odds collected in the requested window.", file=sys.stderr)
        sys.exit(3)

    # features + save
    tidy = add_time_features(tidy)
    tidy = compute_features(tidy)

    pq = os.path.join(outdir, "odds_timeseries.parquet")
    tidy.to_parquet(pq, index=False)
    if args.save_csv:
        csv = os.path.join(outdir, "odds_timeseries.csv")
        tidy.to_csv(csv, index=False)
    print(f"Saved {len(tidy):,} rows to {pq}" +
          (" and CSV" if args.save_csv else ""))

    # LSTM sequences (next-step prediction of [home,draw,away])
    X, y, meta = build_lstm_sequences(
        tidy, lookback=args.lookback, by_bookmaker=True, use_devig=True)
    if X is not None:
        npz = os.path.join(outdir, "lstm_sequences.npz")
        np.savez_compressed(npz, X=X, y=y, meta=np.array(meta, dtype=object))
        print(f"LSTM dataset: X{X.shape}, y{y.shape} -> {npz}")
    else:
        print("Not enough sequential steps to build LSTM arrays (try lookback=1 or include closing+opening).")


if __name__ == "__main__":
    main()
