import os
import requests
import pandas as pd
API = os.environ.get("ODDS_API_KEY")


def get_odds(region="uk", markets="h2h,spreads,totals"):
    url = "https://api.the-odds-api.com/v4/sports/soccer_epl/odds"
    params = dict(apiKey=API, regions=region, markets=markets,
                  oddsFormat="decimal", dateFormat="iso")
    r = requests.get(url, params=params)
    r.raise_for_status()
    return r.json(), r.headers


def get_scores(days_from=3):
    url = "https://api.the-odds-api.com/v4/sports/soccer_epl/scores"
    params = dict(apiKey=API, daysFrom=days_from, dateFormat="iso")
    r = requests.get(url, params=params)
    r.raise_for_status()
    return r.json()


def flatten_odds(events):
    rows = []
    for e in events:
        base = dict(event_id=e["id"], start=e["commence_time"],
                    home=e["home_team"], away=e["away_team"])
        for bk in e.get("bookmakers", []):
            bkey, btime = bk["key"], bk["last_update"]
            markets = {m["key"]: m for m in bk.get("markets", [])}
            for o in markets.get("h2h", {}).get("outcomes", []):
                side = "home" if o["name"] == base["home"] else "away" if o["name"] == base["away"] else "draw"
                rows.append({**base, "bookmaker": bkey, "market": "h2h", "last_update": btime,
                             "side": side, "price": float(o["price"])})
            for o in markets.get("spreads", {}).get("outcomes", []):
                side = "home" if o["name"] == base["home"] else "away"
                rows.append({**base, "bookmaker": bkey, "market": "spread",
                             "last_update": btime, "side": side,
                             "point": float(o["point"]), "price": float(o["price"])})
            for o in markets.get("totals", {}).get("outcomes", []):
                rows.append({**base, "bookmaker": bkey, "market": "total",
                             "last_update": btime, "side": o["name"],
                             "point": float(o["point"]), "price": float(o["price"])})
    return pd.DataFrame(rows)


def implied_prob_decimal(decimal_odds):
    return 1.0/decimal_odds if decimal_odds > 0 else None


events, headers = get_odds(region="uk", markets="h2h,spreads,totals")
odds_df = flatten_odds(events)

odds_df["implied"] = odds_df["price"].apply(implied_prob_decimal)

h2h = odds_df[odds_df["market"] == "h2h"].pivot_table(
    index=["event_id", "bookmaker"], columns="side", values="implied", aggfunc="first").reset_index()

consensus = h2h.groupby("event_id")[["home", "draw", "away"]].mean().rename(
    columns=lambda c: f"consensus_{c}").reset_index()

scores = pd.DataFrame(get_scores(days_from=3))
scores = scores[scores["completed"] == True].copy()
scores["home_goals"] = scores["scores"].apply(
    lambda s: int([t for t in s if t["name"] == "home"][0]["score"]))
scores["away_goals"] = scores["scores"].apply(
    lambda s: int([t for t in s if t["name"] == "away"][0]["score"]))


def outcome(r):
    return "home" if r.home_goals > r.away_goals else "away" if r.away_goals > r.home_goals else "draw"


scores["label"] = scores.apply(outcome, axis=1)
labels = scores[["id", "label"]].rename(columns={"id": "event_id"})

train = consensus.merge(labels, on="event_id", how="inner")
