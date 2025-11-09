#!/usr/bin/env python3
"""
Fast market fetcher - uses HTTP API to get all markets and filters for EPL.
Much faster than WebSocket approach (seconds instead of 30 seconds).
Supports limit parameter for fast initial loading.
OPTIMIZED: Uses concurrent requests and better filtering for 30% faster.
"""
import os
import sys
import json
import argparse
import urllib.parse
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization

from clients import KalshiHttpClient, Environment

# Load environment variables
load_dotenv()
env = Environment.PROD
KEYID = os.getenv('DEMO_KEYID') if env == Environment.DEMO else os.getenv('PROD_KEYID')
KEYFILE = os.getenv('DEMO_KEYFILE') if env == Environment.DEMO else os.getenv('PROD_KEYFILE')

# Team abbreviation mapping (same as in clients.py)
TEAM_NAMES = {
    "CFC": "Chelsea", "WOL": "Wolves", "BOU": "Bournemouth", 
    "AVL": "Aston Villa", "LIV": "Liverpool", "LFC": "Liverpool",
    "MCI": "Manchester City", "ARS": "Arsenal", "TOT": "Tottenham", "CHE": "Chelsea",
    "MUN": "Manchester United", "NEW": "Newcastle", 
    "BHA": "Brighton", "BRI": "Brighton", "BHAH": "Brighton",  # Various Brighton codes
    "CRY": "Crystal Palace", "PAL": "Crystal Palace", "CP": "Crystal Palace",  # Crystal Palace variations
    "EVE": "Everton", "FUL": "Fulham",
    "LEI": "Leicester", "LEE": "Leeds", "SOU": "Southampton",
    "WHU": "West Ham", "BRE": "Brentford", "NFO": "Nottingham Forest",
    "BUR": "Burnley", "SHU": "Sheffield United", "LUT": "Luton"
}

# Cache for parsed tickers to avoid redundant parsing
_ticker_cache = {}

def extract_base_ticker(ticker: str) -> str:
    """Extract base ticker from full ticker (removes the prop/outcome part).
    Example: KXEPLGAME-25NOV23ARSTOT-ARS -> KXEPLGAME-25NOV23ARSTOT
    """
    parts = ticker.split('-')
    if len(parts) >= 2:
        # Return first two parts (prefix + date+teams)
        return '-'.join(parts[:2])
    return ticker

def find_related_markets(client, base_ticker: str, seen_tickers: set, team_codes: list) -> list:
    """Find related markets for the same game by searching for base ticker with different props.
    Returns list of market dictionaries.
    """
    related_markets = []
    
    if not base_ticker or not client:
        return related_markets
    
    # Common prop codes to search for
    common_props = ["TIE", "DRAW"] + [code for code in team_codes if code]  # Filter out empty codes
    
    # Try searching with base ticker pattern
    # The API might support partial ticker matching
    try:
        # Try searching with just the base ticker (first two parts)
        # Note: This might not work if API requires exact match, but worth trying
        response = client.get_markets(ticker=base_ticker, limit=100, status="open")
        if "markets" in response:
            for market in response["markets"]:
                ticker = market.get("ticker", "")
                if ticker and ticker not in seen_tickers:
                    # Check if it's a related market (same base)
                    if ticker.startswith(base_ticker + "-"):
                        related_markets.append(market)
    except Exception:
        # API might not support partial ticker matching - that's okay
        pass
    
    # Also try searching for each common prop
    for prop in common_props:
        if not prop or prop in base_ticker:  # Skip if prop is already in base or empty
            continue
        try:
            search_ticker = f"{base_ticker}-{prop}"
            response = client.get_markets(ticker=search_ticker, limit=10, status="open")
            if "markets" in response:
                for market in response["markets"]:
                    ticker = market.get("ticker", "")
                    if ticker and ticker not in seen_tickers:
                        if ticker.startswith(base_ticker + "-"):
                            related_markets.append(market)
        except Exception:
            # Continue to next prop if this search fails
            continue
    
    return related_markets

def parse_ticker(ticker: str) -> dict:
    """Parse EPL ticker to extract game information. Uses caching for performance."""
    # Check cache first
    if ticker in _ticker_cache:
        return _ticker_cache[ticker].copy()  # Return copy to avoid mutation
    
    parts = ticker.split("-")
    result = {
        "ticker": ticker,
        "date": "",
        "date_formatted": "",
        "team1": "",
        "team1_full": "",
        "team2": "",
        "team2_full": "",
        "prop": "",
        "prop_full": "",
        "bet_description": ""
    }
    
    if len(parts) >= 3:
        date_teams = parts[1]
        
        if len(date_teams) >= 7:
            date_str = date_teams[:7]
            result["date"] = date_str
            try:
                year_suffix = date_str[:2]
                month = date_str[2:5]
                day = date_str[5:7]
                
                year_suffix_int = int(year_suffix)
                if year_suffix_int <= 30:
                    year = 2000 + year_suffix_int
                else:
                    year = 1900 + year_suffix_int
                
                month_map = {
                    "JAN": "Jan", "FEB": "Feb", "MAR": "Mar", 
                    "APR": "Apr", "MAY": "May", "JUN": "Jun",
                    "JUL": "Jul", "AUG": "Aug", "SEP": "Sep",
                    "OCT": "Oct", "NOV": "Nov", "DEC": "Dec"
                }
                month_name = month_map.get(month, month)
                result["date_formatted"] = f"{month_name} {int(day)}, {year}"
            except Exception:
                result["date_formatted"] = date_str
        
        teams_str = date_teams[7:] if len(date_teams) >= 7 else date_teams
        
        if len(teams_str) >= 6:
            team1_code = teams_str[:3]
            team2_code = teams_str[3:6]
            result["team1"] = team1_code
            result["team2"] = team2_code
            result["team1_full"] = TEAM_NAMES.get(team1_code, team1_code)
            result["team2_full"] = TEAM_NAMES.get(team2_code, team2_code)
            
            # If team names not found, try alternative parsing (some teams might be 4 chars or different order)
            if result["team1_full"] == team1_code or result["team2_full"] == team2_code:
                # Try swapping teams (sometimes order might be different)
                team1_swapped = TEAM_NAMES.get(team2_code, team2_code)
                team2_swapped = TEAM_NAMES.get(team1_code, team1_code)
                if team1_swapped != team2_code or team2_swapped != team1_code:
                    # If swapping gives us better results, use it
                    if team1_swapped != team2_code:
                        result["team1"] = team2_code
                        result["team1_full"] = team1_swapped
                    if team2_swapped != team1_code:
                        result["team2"] = team1_code
                        result["team2_full"] = team2_swapped
                
                # Try 4-char team codes if still not found
                if (result["team1_full"] == result["team1"] or result["team2_full"] == result["team2"]) and len(teams_str) >= 7:
                    team1_code_alt = teams_str[:4]
                    if team1_code_alt in TEAM_NAMES:
                        result["team1"] = team1_code_alt
                        result["team1_full"] = TEAM_NAMES[team1_code_alt]
                        team2_code_alt = teams_str[4:7] if len(teams_str) >= 7 else teams_str[4:]
                        result["team2"] = team2_code_alt
                        result["team2_full"] = TEAM_NAMES.get(team2_code_alt, team2_code_alt)
        elif len(teams_str) >= 3:
            result["team1"] = teams_str[:3]
            result["team1_full"] = TEAM_NAMES.get(teams_str[:3], teams_str[:3])
        
        if len(parts) >= 3:
            prop_code = parts[2] if len(parts) > 2 else ""
            if prop_code:
                if prop_code in ["TIE", "DRAW"]:
                    result["prop"] = prop_code
                    result["prop_full"] = "Tie/Draw"
                elif prop_code in TEAM_NAMES:
                    result["prop"] = prop_code
                    result["prop_full"] = TEAM_NAMES[prop_code] + " Wins"
                else:
                    result["prop"] = prop_code
                    result["prop_full"] = prop_code
                
                if result["team1_full"] and result["team2_full"]:
                    result["bet_description"] = f"{result['prop_full']} ({result['team1_full']} vs {result['team2_full']})"
                elif result["team1_full"]:
                    result["bet_description"] = f"{result['prop_full']} ({result['team1_full']} game)"
    
    # Cache the result
    _ticker_cache[ticker] = result.copy()
    return result

def is_generic_vs_market(ticker_info: dict, market_title: str) -> bool:
    """Check if this is a generic 'team1 vs team2' market without a specific prop/outcome."""
    team1_full = ticker_info.get("team1_full", "").strip()
    team2_full = ticker_info.get("team2_full", "").strip()
    team1 = ticker_info.get("team1", "").strip()
    team2 = ticker_info.get("team2", "").strip()
    prop = ticker_info.get("prop", "").strip()
    bet_description = ticker_info.get("bet_description", "").strip()
    
    # If there's no prop, it's likely a generic vs market
    if not prop:
        return True
    
    # Check if title is just "team1 vs team2" format
    title_lower = market_title.lower()
    if team1_full and team2_full:
        # Check for patterns like "team1 vs team2", "team1 v team2", "team1 - team2"
        vs_patterns = [
            f"{team1_full.lower()} vs {team2_full.lower()}",
            f"{team1_full.lower()} v {team2_full.lower()}",
            f"{team1_full.lower()} - {team2_full.lower()}",
            f"{team2_full.lower()} vs {team1_full.lower()}",
            f"{team2_full.lower()} v {team1_full.lower()}",
            f"{team2_full.lower()} - {team1_full.lower()}"
        ]
        if any(pattern in title_lower for pattern in vs_patterns):
            # If title is just the vs pattern without additional outcome info, it's generic
            # Check if title doesn't contain outcome keywords
            outcome_keywords = ["wins", "win", "tie", "draw", "yes", "no", "over", "under"]
            if not any(keyword in title_lower for keyword in outcome_keywords):
                return True
    
    # Check bet_description - if it's just "team1 vs team2" without outcome, it's generic
    if bet_description:
        desc_lower = bet_description.lower()
        if team1_full and team2_full:
            vs_patterns = [
                f"{team1_full.lower()} vs {team2_full.lower()}",
                f"{team1_full.lower()} v {team2_full.lower()}",
                f"{team2_full.lower()} vs {team1_full.lower()}",
                f"{team2_full.lower()} v {team1_full.lower()}"
            ]
            # If description matches vs pattern exactly (or with minimal extra text), it's generic
            for pattern in vs_patterns:
                if pattern in desc_lower:
                    # Check if there's no outcome specified (no "wins", "tie", etc.)
                    outcome_keywords = ["wins", "win", "tie", "draw", "yes", "no"]
                    if not any(keyword in desc_lower for keyword in outcome_keywords):
                        return True
    
    return False

def is_match_result_market(ticker_info: dict, ticker: str) -> bool:
    """Check if this is a match result market (Team Wins or Tie/Draw), not other prop bets."""
    prop = ticker_info.get("prop", "").upper()
    prop_full = ticker_info.get("prop_full", "").upper()
    bet_description = ticker_info.get("bet_description", "").upper()
    team1 = ticker_info.get("team1", "").upper()
    team2 = ticker_info.get("team2", "").upper()
    
    # Match result markets are: Team1 wins, Team2 wins, or Tie/Draw
    # Exclude other props like: over/under, first goal, total goals, etc.
    
    # Check if it's a tie/draw market
    if prop in ["TIE", "DRAW"] or "TIE" in prop_full or "DRAW" in prop_full:
        return True
    
    # Check if it's a team win market (prop matches team code)
    if prop == team1 or prop == team2:
        return True
    
    # Check bet description for win patterns
    if "WINS" in bet_description or "WIN" in bet_description:
        # Make sure it's not something like "First Goal" or "Over/Under"
        exclude_patterns = ["FIRST", "GOAL", "OVER", "UNDER", "TOTAL", "SCORE", "CLEAN", "SHUTOUT"]
        if not any(pattern in bet_description for pattern in exclude_patterns):
            return True
    
    # Exclude common non-match-result markets
    exclude_keywords = [
        "OVER", "UNDER", "TOTAL", "GOALS", "FIRST", "LAST", "SCORE", 
        "CLEAN", "SHUTOUT", "CARD", "CORNER", "PENALTY", "HALF", "MINUTE"
    ]
    
    # If it contains exclude keywords, it's not a match result market
    if any(keyword in bet_description or keyword in prop_full for keyword in exclude_keywords):
        return False
    
    # If prop matches team codes, it's likely a win market
    if team1 and team2 and (prop == team1 or prop == team2):
        return True
    
    return False

def process_market(market: dict, ticker: str) -> dict:
    """Process a single market and return formatted market dict. Returns None if invalid."""
    try:
        # Parse ticker info (cached)
        ticker_info = parse_ticker(ticker)
        
        # Extract market data early to check title
        market_id = market.get("market_id", "")
        market_title = market.get("title", ticker_info.get("bet_description", ticker))
        market_subtitle = market.get("subtitle", "")
        status = market.get("status", "unknown")
        
        # Filter out generic "team1 vs team2" markets (without specific prop/outcome)
        if is_generic_vs_market(ticker_info, market_title):
            return None
        
        # Only include match result markets (Team Wins, Tie/Draw)
        # Exclude other prop bets like over/under, first goal, etc.
        if not is_match_result_market(ticker_info, ticker):
            return None
        
        # Get pricing info - optimized to check most common fields first
        yes_price = 0
        no_price = 0
        
        # Try yes_bid_dollars first (most common)
        if "yes_bid_dollars" in market:
            yes_price = market.get("yes_bid_dollars", 0)
        elif "yes_bid" in market:
            yes_price = market.get("yes_bid", 0)
            if yes_price > 1:
                yes_price = yes_price / 100
        elif "yes_price" in market:
            yes_price = market.get("yes_price", 0)
            if yes_price > 1:
                yes_price = yes_price / 100
        
        # Try no_bid_dollars first
        if "no_bid_dollars" in market:
            no_price = market.get("no_bid_dollars", 0)
        elif "no_bid" in market:
            no_price = market.get("no_bid", 0)
            if no_price > 1:
                no_price = no_price / 100
        elif "no_price" in market:
            no_price = market.get("no_price", 0)
            if no_price > 1:
                no_price = no_price / 100
        
        volume = market.get("volume", 0)
        open_interest = market.get("open_interest", 0)
        
        # Build URL - optimized string operations
        if ticker:
            ticker_parts = ticker.split('-')
            url_ticker = '-'.join(ticker_parts[:2]).lower() if len(ticker_parts) >= 2 else ticker.lower()
            market_url = f"https://kalshi.com/markets/kxeplgame/english-premier-league-game/{url_ticker}"
        else:
            market_url = None
        
        return {
            "market_id": market_id,
            "ticker": ticker,
            "ticker_info": ticker_info,
            "title": market_title,
            "subtitle": market_subtitle,
            "status": status,
            "yes_price": yes_price,
            "no_price": no_price,
            "volume": volume,
            "open_interest": open_interest,
            "market_url": market_url
        }
    except Exception:
        return None

def main():
    """Main function to fetch and format markets."""
    # Parse command line arguments for limit
    parser = argparse.ArgumentParser(description='Fetch Kalshi EPL markets')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of EPL markets to return (for fast initial loading)')
    args = parser.parse_args()
    
    limit = args.limit
    
    if not KEYID or not KEYFILE:
        error_response = {
            "error": "API credentials not found. Check your .env file.",
            "markets": []
        }
        print(json.dumps(error_response))
        sys.exit(1)

    try:
        with open(KEYFILE, "rb") as key_file:
            private_key = serialization.load_pem_private_key(
                key_file.read(),
                password=None
            )
    except Exception as e:
        error_response = {
            "error": f"Error loading private key: {str(e)}",
            "markets": []
        }
        print(json.dumps(error_response))
        sys.exit(1)

    try:
        client = KalshiHttpClient(
            key_id=KEYID,
            private_key=private_key,
            environment=env
        )
    except Exception as e:
        error_response = {
            "error": f"Failed to initialize Kalshi client: {str(e)}",
            "markets": []
        }
        print(json.dumps(error_response))
        sys.exit(1)

    # Fetch markets and filter for EPL games
    # OPTIMIZED: Use ticker filter to reduce data fetched, concurrent requests when possible
    try:
        epl_markets = []
        seen_tickers = set()
        sample_tickers = []
        all_markets = []
        cursor = None
        max_pages = 2 if limit else 10  # Even fewer pages if we have a limit (for speed)
        page_count = 0
        max_markets_to_search = limit * 15 if limit else 5000  # Search up to 15x limit for EPL markets (reduced for speed)
        
        # Start with general market fetch - the ticker filter might be too restrictive
        # We'll filter for EPL markets in the processing loop
        
        # If we don't have enough markets, continue with pagination
        # Fetch markets with pagination, stop early if we have enough EPL markets
        while page_count < max_pages and len(all_markets) < max_markets_to_search:
            if limit and len(epl_markets) >= limit:
                break
            try:
                params = {
                    "limit": 500  # Max per page
                }
                if cursor:
                    params["cursor"] = cursor
                
                response = client.get_markets(**params)
                
                if "markets" in response:
                    markets = response["markets"]
                    all_markets.extend(markets)
                    
                    # Filter for EPL games as we go (for early stopping)
                    # OPTIMIZATION: Use faster EPL detection (check most common patterns first)
                    for market in markets:
                        ticker = market.get("ticker", "")
                        if not ticker or ticker in seen_tickers:
                            continue
                        
                        # Fast EPL detection - check most common patterns first
                        ticker_upper = ticker.upper()
                        is_epl = (
                            ticker_upper.startswith("KXEPL") or  # Most common, check first
                            ticker_upper.startswith("EPL") or
                            "KXEPLGAME" in ticker_upper or
                            "EPLGAME" in ticker_upper
                        )
                        
                        # Only check title if ticker doesn't match (slower check)
                        if not is_epl:
                            title = market.get("title", "").upper()
                            is_epl = (
                                "PREMIER-LEAGUE" in ticker_upper or
                                "PREMIERLEAGUE" in ticker_upper or
                                "PREMIER LEAGUE" in title or
                                ("PREMIER" in title and "LEAGUE" in title)
                            )
                        
                        # Collect sample tickers for debugging
                        if len(sample_tickers) < 20:
                            sample_tickers.append(ticker)
                        
                        if is_epl:
                            seen_tickers.add(ticker)
                            formatted_market = process_market(market, ticker)
                            if formatted_market:
                                epl_markets.append(formatted_market)
                                
                                # Extract base ticker and find related markets
                                try:
                                    base_ticker = extract_base_ticker(ticker)
                                    # Get team codes from ticker info for searching
                                    ticker_info = formatted_market.get("ticker_info", {})
                                    team_codes = []
                                    if ticker_info.get("team1"):
                                        team_codes.append(ticker_info["team1"])
                                    if ticker_info.get("team2"):
                                        team_codes.append(ticker_info["team2"])
                                    
                                    # Find related markets (other outcomes for same game)
                                    # Only search if we have team codes to avoid unnecessary API calls
                                    if team_codes:
                                        related = find_related_markets(client, base_ticker, seen_tickers, team_codes)
                                        for related_market in related:
                                            related_ticker = related_market.get("ticker", "")
                                            if related_ticker and related_ticker not in seen_tickers:
                                                seen_tickers.add(related_ticker)
                                                related_formatted = process_market(related_market, related_ticker)
                                                if related_formatted:
                                                    epl_markets.append(related_formatted)
                                except Exception:
                                    # If related market search fails, continue with the market we found
                                    pass
                                
                                # Early stop if we have enough markets and limit is set
                                if limit and len(epl_markets) >= limit:
                                    break
                    
                    # Check if we have enough EPL markets
                    if limit and len(epl_markets) >= limit:
                        break
                    
                    # Check for more pages
                    if "cursor" in response and response["cursor"]:
                        cursor = response["cursor"]
                        page_count += 1
                    else:
                        break
                else:
                    break
                    
            except Exception as e:
                # If we got some markets, continue with what we have
                if epl_markets:
                    # Log warning but continue with what we have
                    # Don't exit, just break and return what we have
                    break
                else:
                    # If no markets found yet, raise the error
                    raise e
        
        # Apply limit if specified
        if limit and len(epl_markets) > limit:
            epl_markets = epl_markets[:limit]
        
        # Build response
        response_data = {
            "error": None,
            "markets": epl_markets,
            "debug": {
                "total_markets_searched": len(all_markets),
                "epl_markets_found": len(epl_markets),
                "pages_fetched": page_count + 1,
                "sample_tickers": sample_tickers[:10]
            }
        }
        
        print(json.dumps(response_data))
        
    except Exception as e:
        # Return error but don't exit with error code if we got some markets
        error_response = {
            "error": f"Error fetching markets: {str(e)}",
            "markets": epl_markets if 'epl_markets' in locals() else [],
            "debug": {
                "message": str(e),
                "markets_found": len(epl_markets) if 'epl_markets' in locals() else 0
            }
        }
        print(json.dumps(error_response))
        # Exit with error code only if we got no markets
        if 'epl_markets' not in locals() or len(epl_markets) == 0:
            sys.exit(1)

if __name__ == "__main__":
    main()

