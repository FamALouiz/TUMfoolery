#!/usr/bin/env python3
"""
EPL DATASET (free sources): results + odds (open/close) + Elo + form/splits/H2H/rest

Sources
- Football-Data.co.uk CSVs (FREE): results + opening/closing odds since 2000/01.
  Notes: closing odds columns end with 'C' (e.g., B365CH/B365CD/B365CA).  # docs: notes.txt
- ClubElo CSV API (FREE): Elo ratings by date (no key required).

Optionally
- Public vs money splits (e.g., VSiN DraftKings): pass a CSV you exported (see --splits-csv).

Outputs
  data/epl_dataset.parquet  (master feature table)
  data/epl_dataset.csv      (if --save-csv)

Usage
  python build_epl_dataset.py --start 2016-08-01 --end 2025-06-30 --save-csv \
    --splits-csv path/to/epl_splits.csv
"""

import os
import io
import sys
import argparse
import time
import math
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Tuple

import numpy as np
import pandas as pd
import requests
from dateutil import parser as dtparse

# ============================= Config =============================

FD_BASE = "https://www.football-data.co.uk/mmz4281"
EPL_FILE = "E0.csv"  # Premier League
OUTDIR = "data"

BOOKMAKER_PREFIXES_PRIORITY = [
    # typical H2H prefixes present across seasons (opening)
    "PS", "B365", "BW", "IW", "LB", "WH", "VC",
    # closing versions (suffix 'C') – we will detect dynamically but include for ordering
    "PSC", "B365C", "BWC", "IWC", "LBC", "WHC", "VCC",
    # also averages/max (avg/max include closing AVGC/MAXC)
    "AVG", "AVGC", "MAX", "MAXC"
]

# optional: better fuzzy matching if installed
try:
    from rapidfuzz import process as fuzzproc, fuzz
    HAVE_FUZZ = True
except Exception:
    import difflib
    HAVE_FUZZ = False

# ============================= Helpers =============================


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def to_dt(s: str) -> datetime:
    return dtparse.isoparse(s).astimezone(timezone.utc)


def season_code(year_start: int) -> str:
    y1 = str(year_start % 100).zfill(2)
    y2 = str((year_start + 1) % 100).zfill(2)
    return f"{y1}{y2}"


def seasons_covering_range(date_from: datetime, date_to: datetime) -> List[int]:
    ys = set()
    y = date_from.year - 1
    while y <= date_to.year:
        ys.add(y)
        y += 1
    return sorted(ys)


def safe_float(x):
    try:
        return float(x) if x not in (None, "", " ") else None
    except:
        return None


def normalize_team(name: str) -> str:
    if not isinstance(name, str):
        return name
    s = name.strip()
    subs = {
        "Man United": "Manchester United",
        "Man Utd": "Manchester United",
        "Manchester Utd": "Manchester United",
        "Man City": "Manchester City",
        "Wolves": "Wolverhampton",
        "Spurs": "Tottenham",
        "West Brom": "West Bromwich Albion",
        "Brighton and Hove Albion": "Brighton",
        "Brighton & Hove Albion": "Brighton",
        "Leeds Utd": "Leeds",
        "Newcastle Utd": "Newcastle",
        "Sheffield Utd": "Sheffield United",
        "Nott'm Forest": "Nottingham Forest",
        "Nott Forest": "Nottingham Forest",
        "Bournemouth": "AFC Bournemouth",
        "Cardiff": "Cardiff City",
        "Huddersfield": "Huddersfield Town",
        "Norwich": "Norwich City",
        "QPR": "Queens Park Rangers",
        "Swansea": "Swansea City",
        "Hull": "Hull City",
        "Birmingham": "Birmingham City",
        "Leicester": "Leicester City",
        "Stoke": "Stoke City",
        "West Ham": "West Ham United",
        "Tottenham Hotspur": "Tottenham",
    }
    return subs.get(s, s)


def fuzzy_match(a: str, choices: List[str]) -> str:
    if not choices:
        return a
    if HAVE_FUZZ:
        cand, score, _ = fuzzproc.extractOne(a, choices, scorer=fuzz.WRatio)
        return cand if score >= 85 else a
    # fallback
    best = difflib.get_close_matches(a, choices, n=1, cutoff=0.85)
    return best[0] if best else a

# ================= Football-Data.co.uk (FREE) =====================


def load_fdata_season(year_start: int) -> Optional[pd.DataFrame]:
    url = f"{FD_BASE}/{season_code(year_start)}/{EPL_FILE}"
    r = requests.get(url, timeout=30)
    if r.status_code != 200:
        return None
    df = pd.read_csv(io.StringIO(r.text))
    df["SeasonStart"] = year_start
    if "Date" in df.columns:
        # dates are dayfirst; no explicit kickoff time – we attach noon UTC for determinism
        dt = pd.to_datetime(df["Date"], dayfirst=True, errors="coerce")
        df["KickoffUTC"] = pd.to_datetime(
            dt.dt.date.astype(str) + " 12:00:00", utc=True)
    return df


def list_bookmaker_prefixes(df: pd.DataFrame) -> List[str]:
    cols = set(df.columns)
    prefixes = []
    for c in cols:
        if len(c) >= 2 and c.endswith("H"):
            pref = c[:-1]
            if (pref+"D") in cols and (pref+"A") in cols:
                prefixes.append(pref)
    # keep stable priority ordering
    prefixes_sorted = [p for p in BOOKMAKER_PREFIXES_PRIORITY if p in prefixes]
    for p in sorted(prefixes):
        if p not in prefixes_sorted:
            prefixes_sorted.append(p)
    return prefixes_sorted


def melt_odds_triplets(row: pd.Series, pref: str, match_dt: pd.Timestamp) -> List[Dict]:
    h, d, a = safe_float(
        row.get(pref+"H")), safe_float(row.get(pref+"D")), safe_float(row.get(pref+"A"))
    if h is None or d is None or a is None:
        return []
    phase = "close" if pref.endswith("C") else "open"
    shot_time = match_dt - (timedelta(hours=1) if phase ==
                            "close" else timedelta(hours=24))
    base = {
        "snapshot_time": iso(shot_time.to_pydatetime()),
        "commence_time": iso(match_dt.to_pydatetime()),
        "event_key": f"{row['SeasonStart']}-{row['HomeTeam']}-{row['AwayTeam']}-{match_dt.date()}",
        "home": normalize_team(row["HomeTeam"]),
        "away": normalize_team(row["AwayTeam"]),
        "bookmaker": pref,
        "market": "h2h",
        "phase": phase
    }
    return [
        {**base, "side": "home", "point": None, "price": h},
        {**base, "side": "draw", "point": None, "price": d},
        {**base, "side": "away", "point": None, "price": a},
    ]


def build_odds_from_fdata(df_all: pd.DataFrame, start: datetime, end: datetime) -> Tuple[pd.DataFrame, pd.DataFrame]:
    # core match table (labels)
    base_cols = [c for c in ["SeasonStart", "Date", "KickoffUTC",
                             "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR"] if c in df_all.columns]
    matches = df_all[base_cols].copy()
    matches = matches[(matches["KickoffUTC"].notna()) &
                      (matches["KickoffUTC"] >= pd.Timestamp(start)) &
                      (matches["KickoffUTC"] <= pd.Timestamp(end))]
    matches["HomeTeam"] = matches["HomeTeam"].apply(normalize_team)
    matches["AwayTeam"] = matches["AwayTeam"].apply(normalize_team)
    matches["event_key"] = matches.apply(
        lambda r: f"{r['SeasonStart']}-{r['HomeTeam']}-{r['AwayTeam']}-{r['KickoffUTC'].date()}", axis=1)

    # flatten odds triplets
    prefixes = list_bookmaker_prefixes(df_all)
    rows = []
    for _, r in matches.iterrows():
        row_full = df_all[(df_all["SeasonStart"].eq(r["SeasonStart"])) &
                          (df_all["HomeTeam"].eq(r["HomeTeam"])) &
                          (df_all["AwayTeam"].eq(r["AwayTeam"])) &
                          (pd.to_datetime(df_all["Date"], dayfirst=True, errors="coerce").dt.date == r["KickoffUTC"].date())]
        if row_full.empty:
            continue
        rf = row_full.iloc[0]
        for pref in prefixes:
            rows.extend(melt_odds_triplets(rf, pref, r["KickoffUTC"]))
    odds = pd.DataFrame(rows)
    return matches.reset_index(drop=True), odds

# ================= Elo (ClubElo CSV API) =========================


def fetch_clubelo_by_date(dt: datetime) -> Optional[pd.DataFrame]:
    # ClubElo CSV API: access by date yields full-day ranking table (team, country, elo, from, to)
    # Example in soccerdata docs: http://api.clubelo.com (CSV API by date / by team)
    url = f"http://api.clubelo.com/{dt.date().isoformat()}"
    r = requests.get(url, timeout=30)
    if r.status_code != 200 or not r.text or r.text.startswith("<"):
        return None
    df = pd.read_csv(io.StringIO(r.text))
    # expected columns: 'team','country','level','elo','from','to','...'
    for c in ["from", "to"]:
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors="coerce", utc=True)
    return df


def build_elo_table(match_dates: List[pd.Timestamp]) -> pd.DataFrame:
    # de-duplicate by date to keep requests small
    unique_days = sorted({pd.Timestamp(d.date(), tz="UTC")
                         for d in match_dates})
    frames = []
    for d in unique_days:
        df = fetch_clubelo_by_date(d.to_pydatetime())
        if df is not None and not df.empty:
            df["elo_date"] = d
            frames.append(
                df[["Club", "Country", "Elo", "From", "To", "elo_date"]])
        time.sleep(0.1)
    if not frames:
        return pd.DataFrame(columns=["Club", "Elo", "From", "To", "elo_date"])
    elo_all = pd.concat(frames, ignore_index=True)
    # normalize team names
    elo_all["team_norm"] = elo_all["Club"].apply(normalize_team)

    elo_all.columns = elo_all.columns.str.lower()
    return elo_all


def attach_elo(matches: pd.DataFrame, elo_all: pd.DataFrame) -> pd.DataFrame:
    # For each match, pick Elo where match kickoff is within [from, to]
    out = matches.copy()
    out["home_elo"] = np.nan
    out["away_elo"] = np.nan
    for idx, r in out.iterrows():
        ko = pd.Timestamp(r["KickoffUTC"])
        # candidate rows where ko within range
        home_rows = elo_all[(elo_all["team_norm"] == r["HomeTeam"]) &
                            (pd.to_datetime(elo_all["from"], utc=True) <= ko) &
                            (pd.to_datetime(elo_all["to"], utc=True) >= ko)]
        away_rows = elo_all[(elo_all["team_norm"] == r["AwayTeam"]) &
                            (pd.to_datetime(elo_all["from"], utc=True) <= ko) &
                            (pd.to_datetime(elo_all["to"], utc=True) >= ko)]
        if not home_rows.empty:
            out.at[idx, "home_elo"] = home_rows.iloc[0]["elo"]
        if not away_rows.empty:
            out.at[idx, "away_elo"] = away_rows.iloc[0]["elo"]
    return out

# ================= Feature Engineering ===========================


def devig_probs(h, d, a):
    try:
        ih, idd, ia = 1/float(h), 1/float(d), 1/float(a)
        s = ih+idd+ia
        return ih/s, idd/s, ia/s
    except:
        return (np.nan, np.nan, np.nan)


def compute_odds_features(odds: pd.DataFrame) -> pd.DataFrame:
    if odds.empty:
        return odds
    df = odds.copy()
    # implied
    df["implied"] = np.where(df["price"].notna(), 1.0/df["price"], np.nan)
    # de-vig only for h2h at a given snapshot (event, book, time)
    h2h = df[df["market"] == "h2h"].copy()
    if not h2h.empty:
        def devig_group(g):
            s = g["implied"].sum()
            g["devig"] = g["implied"]/s if s and s > 0 else np.nan
            return g
        h2h = h2h.groupby(["event_key", "bookmaker", "snapshot_time"],
                          group_keys=False).apply(devig_group)
        df = pd.concat([df.drop(h2h.index), h2h], ignore_index=False)
    # pivot to open/close consensus per event
    pivot = df[df["market"] == "h2h"].pivot_table(
        index=["event_key", "bookmaker", "snapshot_time", "phase"],
        columns="side", values="devig", aggfunc="first"
    ).reset_index()
    # consensus per event & phase
    cons = pivot.groupby(["event_key", "phase"])[
        ["home", "draw", "away"]].mean().reset_index()
    cons = cons.rename(columns={"home": "consensus_home",
                       "draw": "consensus_draw", "away": "consensus_away"})
    # split open/close
    cons_open = cons[cons["phase"] == "open"].drop(columns=["phase"])
    cons_close = cons[cons["phase"] == "close"].drop(columns=["phase"])
    cons_all = pd.merge(cons_open, cons_close, on="event_key",
                        how="outer", suffixes=("_open", "_close"))
    # deltas
    for s in ["home", "draw", "away"]:
        cons_all[f"consensus_{s}_delta"] = cons_all.get(
            f"consensus_{s}_close") - cons_all.get(f"consensus_{s}_open")
    return df, cons_all


def long_team_table(matches: pd.DataFrame) -> pd.DataFrame:
    # create per-team rows to compute rolling features
    rows = []
    for _, r in matches.iterrows():
        # home row
        rows.append({
            "event_key": r["event_key"],
            "team": r["HomeTeam"], "opp": r["AwayTeam"],
            "is_home": 1, "date": r["KickoffUTC"],
            "gf": r["FTHG"], "ga": r["FTAG"],
            "result": 1 if r["FTR"] == "H" else (0 if r["FTR"] == "D" else -1),
            "points": 3 if r["FTR"] == "H" else 1 if r["FTR"] == "D" else 0
        })
        # away row
        rows.append({
            "event_key": r["event_key"],
            "team": r["AwayTeam"], "opp": r["HomeTeam"],
            "is_home": 0, "date": r["KickoffUTC"],
            "gf": r["FTAG"], "ga": r["FTHG"],
            "result": 1 if r["FTR"] == "A" else (0 if r["FTR"] == "D" else -1),
            "points": 3 if r["FTR"] == "A" else 1 if r["FTR"] == "D" else 0
        })
    return pd.DataFrame(rows)


def rolling_features(team_long: pd.DataFrame, windows=(5, 10)) -> pd.DataFrame:
    tl = team_long.sort_values(["team", "date"]).copy()
    tl["prev_date"] = tl.groupby("team")["date"].shift(1)
    tl["rest_days"] = (tl["date"] - tl["prev_date"]).dt.total_seconds()/86400.0
    # home/away rolling (last N prior matches)
    feats = []
    for N in windows:
        g = tl.groupby("team", group_keys=False).apply(
            lambda x: x.assign(
                **{
                    f"form{N}_winrate": x["result"].apply(lambda r: 1 if r == 1 else 0).rolling(N, min_periods=1).mean().shift(1),
                    f"form{N}_ppg": x["points"].rolling(N, min_periods=1).mean().shift(1),
                    f"form{N}_gd_avg": (x["gf"]-x["ga"]).rolling(N, min_periods=1).mean().shift(1),
                }
            )
        )
        feats.append(g)
    tl = feats[-1]  # last assignment contains all new columns
    # home-only and away-only splits (last 10)
    for side, mask in [("home", tl["is_home"] == 1), ("away", tl["is_home"] == 0)]:
        part = tl[mask].groupby("team", group_keys=False).apply(
            lambda x: x.assign(
                **{
                    f"{side}10_winrate": x["result"].apply(lambda r: 1 if r == 1 else 0).rolling(10, min_periods=1).mean().shift(1),
                    f"{side}10_ppg": x["points"].rolling(10, min_periods=1).mean().shift(1),
                    f"{side}10_gd_avg": (x["gf"]-x["ga"]).rolling(10, min_periods=1).mean().shift(1),
                }
            )
        )
        tl.loc[part.index, [f"{side}10_winrate", f"{side}10_ppg", f"{side}10_gd_avg"]] = \
            part[[f"{side}10_winrate", f"{side}10_ppg", f"{side}10_gd_avg"]]
    return tl


def h2h_last_k(matches: pd.DataFrame, k=5) -> pd.DataFrame:
    # compute last-k head-to-head results (home POV) before each match
    m = matches.sort_values("KickoffUTC").copy()
    m["h2h_home_wins"] = np.nan
    m["h2h_home_draws"] = np.nan
    m["h2h_home_losses"] = np.nan
    # index past meetings for quick lookup
    key = m.apply(lambda r: tuple(
        sorted([r["HomeTeam"], r["AwayTeam"]])), axis=1)
    m["_pair"] = key
    pair_groups = m.groupby("_pair")
    for pair, grp in pair_groups:
        grp = grp.sort_values("KickoffUTC")
        prev = []
        for idx, r in grp.iterrows():
            # count last k prior results from home team's perspective
            hist = [x for x in prev if x["date"] < r["KickoffUTC"]]
            hist = hist[-k:]
            w = d = l = 0
            for h in hist:
                # perspective of the home team in r
                if r["HomeTeam"] == h["home"]:
                    # home was home in that hist
                    res = h["FTR"]
                    if res == "H":
                        w += 1
                    elif res == "D":
                        d += 1
                    else:
                        l += 1
                else:
                    # home in r was away in that hist
                    res = h["FTR"]
                    if res == "A":
                        w += 1
                    elif res == "D":
                        d += 1
                    else:
                        l += 1
            m.at[idx, "h2h_home_wins"] = w
            m.at[idx, "h2h_home_draws"] = d
            m.at[idx, "h2h_home_losses"] = l
            prev.append({"date": r["KickoffUTC"], "FTR": r["FTR"],
                        "home": r["HomeTeam"], "away": r["AwayTeam"]})
    return m.drop(columns=["_pair"])

# ================= Public vs Money Splits (optional) ==============


def load_splits_csv(path: str) -> pd.DataFrame:
    """
    Expect columns at minimum:
      date (YYYY-MM-DD or ISO), home, away, market ('moneyline' or 'h2h'), side ('home','draw','away'),
      bets_pct (0-100), handle_pct (0-100)
    Merge is done on (date, home, away).
    """
    df = pd.read_csv(path)
    # normalize
    for c in ["home", "away"]:
        if c in df.columns:
            df[c] = df[c].apply(normalize_team)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce", utc=True)
        df["date_d"] = df["date"].dt.date
    return df


def aggregate_splits_for_event(splits: pd.DataFrame) -> pd.DataFrame:
    if splits is None or splits.empty:
        return pd.DataFrame()
    # pivot to columns per side
    money = splits.pivot_table(
        index=["date_d", "home", "away"], columns="side",
        values=["bets_pct", "handle_pct"], aggfunc="last"
    )
    money.columns = [f"{a}_{b}" for a, b in money.columns]
    money = money.reset_index()
    # feature: handle - bets (per side)
    for s in ["home", "draw", "away"]:
        if f"handle_pct_{s}" in money.columns and f"bets_pct_{s}" in money.columns:
            money[f"edge_{s}"] = money[f"handle_pct_{s}"] - \
                money[f"bets_pct_{s}"]
    return money

# ===================== Main build =================================


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True, help="YYYY-MM-DD")
    ap.add_argument("--end", required=True, help="YYYY-MM-DD")
    ap.add_argument("--save-csv", action="store_true")
    ap.add_argument(
        "--splits-csv", help="Path to exported betting splits CSV (optional).")
    args = ap.parse_args()

    os.makedirs(OUTDIR, exist_ok=True)
    date_from = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)
    date_to = datetime.fromisoformat(args.end).replace(tzinfo=timezone.utc)

    # 1) Load Football-Data seasons & build matches + odds
    seasons = seasons_covering_range(date_from, date_to)
    frames = []
    for y in seasons:
        df = load_fdata_season(y)
        if df is not None:
            frames.append(df)
            print(
                f"Loaded Football-Data season {y}/{(y+1) % 100:02d} ({len(df)} rows)")
        time.sleep(0.1)
    if not frames:
        print("No Football-Data seasons loaded.", file=sys.stderr)
        sys.exit(2)
    raw = pd.concat(frames, ignore_index=True)

    matches, odds = build_odds_from_fdata(raw, date_from, date_to)
    if matches.empty:
        print("No matches in window.", file=sys.stderr)
        sys.exit(3)

    # 2) Elo on match dates (ClubElo CSV API)
    elo_all = build_elo_table(list(matches["KickoffUTC"]))
    matches = attach_elo(matches, elo_all)

    # 3) Odds features (devig + consensus + open→close deltas)
    odds_full, cons = compute_odds_features(odds)

    # 4) Recent form, home/away splits, rest days
    team_long = long_team_table(matches)
    team_roll = rolling_features(team_long, windows=(5, 10))

    print(team_roll.columns.tolist())

    home_feats = team_roll[team_roll["is_home"] == 1][["event_key", "team",
                                                       "form10_winrate", "form10_ppg", "form10_gd_avg",
                                                       "home10_winrate", "home10_ppg", "home10_gd_avg", "rest_days"]].copy()
    away_feats = team_roll[team_roll["is_home"] == 0][["event_key", "team",
                                                       "form10_winrate", "form10_ppg", "form10_gd_avg",
                                                       "away10_winrate", "away10_ppg", "away10_gd_avg", "rest_days"]].copy()
    home_feats = home_feats.add_prefix("home_").rename(
        columns={"home_event_key": "event_key", "home_team": "home_team_name"})
    away_feats = away_feats.add_prefix("away_").rename(
        columns={"away_event_key": "event_key", "away_team": "away_team_name"})

    # 5) H2H last 5
    m_h2h = h2h_last_k(matches, k=5)[
        ["event_key", "h2h_home_wins", "h2h_home_draws", "h2h_home_losses"]]

    # 6) Optional public vs money splits
    if args.splits_csv:
        splits_raw = load_splits_csv(args.splits_csv)
        splits_agg = aggregate_splits_for_event(splits_raw)
        # merge on (date, home, away) vs our (KickoffUTC.date(), HomeTeam, AwayTeam)
        matches["date_d"] = matches["KickoffUTC"].dt.date
        money = matches.merge(
            splits_agg,
            left_on=["date_d", "HomeTeam", "AwayTeam"],
            right_on=["date_d", "home", "away"],
            how="left"
        ).drop(columns=["home", "away"])
    else:
        money = matches.copy()

    # 7) Build final table
    label_cols = ["FTHG", "FTAG", "FTR"]
    base_cols = ["event_key", "KickoffUTC", "HomeTeam",
                 "AwayTeam", "home_elo", "away_elo"] + label_cols
    final = matches[base_cols].copy()

    # attach consensus open/close + deltas
    final = final.merge(cons, on="event_key", how="left")

    # attach team features
    final = final.merge(home_feats, on="event_key", how="left")
    final = final.merge(away_feats, on="event_key", how="left")

    # attach H2H
    final = final.merge(m_h2h, on="event_key", how="left")

    # attach money splits (if present)
    money_cols = [c for c in money.columns if c.startswith(
        ("bets_pct_", "handle_pct_", "edge_"))]
    if money_cols:
        final = final.merge(
            money[["event_key"]+money_cols], on="event_key", how="left")

    # label in {home, draw, away}
    def label_from_ftr(x):
        return {"H": "home", "D": "draw", "A": "away"}.get(x, None)
    final["label"] = final["FTR"].map(label_from_ftr)
    final["goal_diff"] = final["FTHG"] - final["FTAG"]

    # Save
    os.makedirs(OUTDIR, exist_ok=True)
    pq = os.path.join(OUTDIR, "epl_dataset.parquet")
    final.to_parquet(pq, index=False)
    print(f"Saved master dataset: {pq} ({len(final)} rows)")

    # Also emit odds row-level table (optional for auditing)
    odds_path = os.path.join(
        OUTDIR, f"epl_odds_rows-{args.start}-{args.end}.parquet")
    odds_full.to_parquet(odds_path, index=False)
    print(f"Saved flattened odds rows: {odds_path} ({len(odds_full)} rows)")

    # CSV optional
    if args.save_csv:
        final.to_csv(os.path.join(OUTDIR, "epl_dataset.csv"), index=False)
        odds_full.to_csv(os.path.join(
            OUTDIR, f"epl_odds_rows-{args.start}-{args.end}.csv"), index=False)


if __name__ == "__main__":
    main()
