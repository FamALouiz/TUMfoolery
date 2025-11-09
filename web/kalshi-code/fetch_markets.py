#!/usr/bin/env python3
"""
Fetch Kalshi markets script that outputs EPL market data as JSON.
This script fetches markets from the Kalshi API and filters for EPL games.
"""
import os
import sys
import json
import urllib.parse
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization

from clients import KalshiHttpClient, Environment

# Load environment variables
load_dotenv()
env = Environment.PROD  # toggle environment here (try PROD if DEMO doesn't work)
KEYID = os.getenv('DEMO_KEYID') if env == Environment.DEMO else os.getenv('PROD_KEYID')
KEYFILE = os.getenv('DEMO_KEYFILE') if env == Environment.DEMO else os.getenv('PROD_KEYFILE')

# Team abbreviation mapping (same as in clients.py)
TEAM_NAMES = {
    "CFC": "Chelsea", "WOL": "Wolves", "BOU": "Bournemouth", 
    "AVL": "Aston Villa", "LIV": "Liverpool", "LFC": "Liverpool", "MCI": "Manchester City",
    "ARS": "Arsenal", "TOT": "Tottenham", "CHE": "Chelsea",
    "MUN": "Manchester United", "NEW": "Newcastle", 
    "BHA": "Brighton", "BRI": "Brighton", "BHAH": "Brighton",  # Various Brighton codes
    "CRY": "Crystal Palace", "PAL": "Crystal Palace", "CP": "Crystal Palace",  # Crystal Palace variations
    "EVE": "Everton", "FUL": "Fulham",
    "LEI": "Leicester", "LEE": "Leeds", "SOU": "Southampton",
    "WHU": "West Ham", "BRE": "Brentford", "NFO": "Nottingham Forest",
    "BUR": "Burnley", "SHU": "Sheffield United", "LUT": "Luton"
}

def parse_ticker(ticker: str) -> dict:
    """Parse EPL ticker to extract game information."""
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
        # Second part contains date + teams: "25NOV08CFCWOL"
        date_teams = parts[1]
        
        # Extract date (first 7 characters: 25NOV08)
        if len(date_teams) >= 7:
            date_str = date_teams[:7]  # "25NOV08"
            result["date"] = date_str
            # Format date nicely: 25NOV08 -> Nov 8, 2025
            try:
                year_suffix = date_str[:2]  # "25" = 2025
                month = date_str[2:5]       # "NOV"
                day = date_str[5:7]         # "08" = day 8
                
                # Convert year suffix to full year
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
        
        # Extract teams (remaining after date)
        teams_str = date_teams[7:] if len(date_teams) >= 7 else date_teams  # "CFCWOL"
        
        # Split teams (usually 3 letters each)
        if len(teams_str) >= 6:
            team1_code = teams_str[:3]
            team2_code = teams_str[3:6]
            result["team1"] = team1_code
            result["team2"] = team2_code
            result["team1_full"] = TEAM_NAMES.get(team1_code, team1_code)
            result["team2_full"] = TEAM_NAMES.get(team2_code, team2_code)
            
            # If team names not found, try alternative parsing
            if result["team1_full"] == team1_code or result["team2_full"] == team2_code:
                # Try swapping teams (sometimes order might be different)
                team1_swapped = TEAM_NAMES.get(team2_code, team2_code)
                team2_swapped = TEAM_NAMES.get(team1_code, team1_code)
                if team1_swapped != team2_code or team2_swapped != team1_code:
                    if team1_swapped != team2_code:
                        result["team1"] = team2_code
                        result["team1_full"] = team1_swapped
                    if team2_swapped != team1_code:
                        result["team2"] = team1_code
                        result["team2_full"] = team2_swapped
        elif len(teams_str) >= 3:
            result["team1"] = teams_str[:3]
            result["team1_full"] = TEAM_NAMES.get(teams_str[:3], teams_str[:3])
        
        # Third part is the prop/outcome
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
                
                # Build bet description
                if result["team1_full"] and result["team2_full"]:
                    result["bet_description"] = f"{result['prop_full']} ({result['team1_full']} vs {result['team2_full']})"
                elif result["team1_full"]:
                    result["bet_description"] = f"{result['prop_full']} ({result['team1_full']} game)"
    
    return result

def main():
    """Main function to fetch and format markets."""
    # Check credentials
    if not KEYID:
        error_response = {
            "error": f"API Key ID not found. Check your .env file for {'DEMO_KEYID' if env == Environment.DEMO else 'PROD_KEYID'}",
            "markets": []
        }
        print(json.dumps(error_response))
        sys.exit(1)

    if not KEYFILE:
        error_response = {
            "error": f"Key file path not found. Check your .env file for {'DEMO_KEYFILE' if env == Environment.DEMO else 'PROD_KEYFILE'}",
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
    except FileNotFoundError:
        error_response = {
            "error": f"Private key file not found at {KEYFILE}",
            "markets": []
        }
        print(json.dumps(error_response))
        sys.exit(1)
    except Exception as e:
        error_response = {
            "error": f"Error loading private key: {str(e)}",
            "markets": []
        }
        print(json.dumps(error_response))
        sys.exit(1)

    # Initialize the HTTP client
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

    # Fetch markets
    try:
        # Try to fetch markets with EPL ticker pattern
        # First, try searching for markets with EPLGAME in ticker
        all_markets = []
        cursor = None
        total_searched = 0
        patterns_tried = []
        
        # Try different search patterns
        # Search for various EPL-related patterns
        search_patterns = ["EPLGAME", "EPL", "KXEPLGAME", "PREMIER-LEAGUE", "PREMIERLEAGUE"]
        
        for pattern in search_patterns:
            patterns_tried.append(pattern)
            try:
                # Try with status filter first
                response = client.get_markets(
                    ticker=pattern,
                    limit=100,
                    status="open"
                )
                
                if "markets" in response:
                    markets = response["markets"]
                    all_markets.extend(markets)
                    total_searched += len(markets)
                    
                    # Check if there's a cursor for pagination
                    if "cursor" in response and response["cursor"]:
                        cursor = response["cursor"]
                
                # Also try without status filter (in case markets are not "open" but still active)
                if not markets or len(markets) == 0:
                    response_no_status = client.get_markets(
                        ticker=pattern,
                        limit=100
                    )
                    if "markets" in response_no_status:
                        markets_no_status = response_no_status["markets"]
                        # Avoid duplicates
                        existing_tickers = {m.get("ticker") for m in all_markets}
                        new_markets = [m for m in markets_no_status if m.get("ticker") not in existing_tickers]
                        all_markets.extend(new_markets)
                        total_searched += len(new_markets)
            except Exception as e:
                # Continue to next pattern if this one fails
                continue
        
        # If no markets found with patterns, try fetching all markets and filtering
        # Also try without status filter and with different limits
        if not all_markets:
            try:
                # Try fetching without status filter first
                response = client.get_markets(limit=1000)
                if "markets" in response:
                    all_markets = response["markets"]
                    total_searched = len(all_markets)
                    
                    # If we got a cursor, try to get more
                    if "cursor" in response and response["cursor"]:
                        try:
                            response2 = client.get_markets(limit=1000, cursor=response["cursor"])
                            if "markets" in response2:
                                all_markets.extend(response2["markets"])
                                total_searched += len(response2["markets"])
                        except:
                            pass
            except Exception as e:
                # Try with status filter as fallback
                try:
                    response = client.get_markets(limit=500, status="open")
                    if "markets" in response:
                        all_markets = response["markets"]
                        total_searched = len(all_markets)
                except Exception as e2:
                    error_response = {
                        "error": f"Failed to fetch markets: {str(e)}",
                        "markets": [],
                        "debug": {
                            "message": str(e),
                            "fallback_error": str(e2),
                            "patterns_tried": patterns_tried
                        }
                    }
                    print(json.dumps(error_response))
                    sys.exit(1)
        
        # Filter for EPL games
        epl_markets = []
        sample_tickers = []
        
        for market in all_markets:
            ticker = market.get("ticker", "")
            ticker_upper = ticker.upper()
            title = market.get("title", "").upper()
            subtitle = market.get("subtitle", "").upper()
            
            # Check if it's an EPL-related market
            is_epl = (
                "EPLGAME" in ticker_upper or
                "EPL" in ticker_upper or
                "PREMIER-LEAGUE" in ticker_upper or
                "PREMIERLEAGUE" in ticker_upper or
                "PREMIER LEAGUE" in title or
                "PREMIER-LEAGUE" in title or
                "PREMIERLEAGUE" in title
            )
            
            if is_epl:
                # Parse ticker info (use original ticker, not uppercase)
                ticker_info = parse_ticker(ticker)
                
                # Extract market data
                market_id = market.get("market_id", "")
                market_title = market.get("title", ticker_info.get("bet_description", ticker))
                market_subtitle = market.get("subtitle", "")
                status = market.get("status", "unknown")
                
                # Get pricing info - try different field names
                # Kalshi API may return prices in different formats
                yes_price = 0
                no_price = 0
                
                # Try various field names for yes price
                if "yes_bid_dollars" in market:
                    yes_price = market.get("yes_bid_dollars", 0)
                elif "yes_bid" in market:
                    yes_price = market.get("yes_bid", 0)
                    # If price > 1, it's likely in cents, convert to dollars
                    if yes_price > 1:
                        yes_price = yes_price / 100
                elif "yes_price" in market:
                    yes_price = market.get("yes_price", 0)
                    if yes_price > 1:
                        yes_price = yes_price / 100
                
                # Try various field names for no price
                if "no_bid_dollars" in market:
                    no_price = market.get("no_bid_dollars", 0)
                elif "no_bid" in market:
                    no_price = market.get("no_bid", 0)
                    # If price > 1, it's likely in cents, convert to dollars
                    if no_price > 1:
                        no_price = no_price / 100
                elif "no_price" in market:
                    no_price = market.get("no_price", 0)
                    if no_price > 1:
                        no_price = no_price / 100
                
                volume = market.get("volume", 0)
                open_interest = market.get("open_interest", 0)
                
                # Build market URL - Kalshi uses /markets/kxeplgame/english-premier-league-game/{ticker}
                # Remove the prop part (last segment) and convert to lowercase
                # Format: KXEPLGAME-25NOV09MCILFC-MCI -> kxeplgame-25nov09mcilfc
                if ticker:
                    ticker_parts = ticker.split('-')
                    # Take first two parts (prefix and date+teams), skip the prop part
                    url_ticker = '-'.join(ticker_parts[:2]).lower() if len(ticker_parts) >= 2 else ticker.lower()
                    market_url = f"https://kalshi.com/markets/kxeplgame/english-premier-league-game/{url_ticker}"
                else:
                    market_url = None
                
                formatted_market = {
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
                
                epl_markets.append(formatted_market)
            else:
                # Collect sample tickers for debugging
                if len(sample_tickers) < 10:
                    sample_tickers.append(ticker)
        
        # Build response
        response_data = {
            "error": None,
            "markets": epl_markets,
            "debug": {
                "total_markets_searched": total_searched,
                "epl_markets_found": len(epl_markets),
                "sample_tickers": sample_tickers[:10],
                "patterns_searched": patterns_tried,
                "all_tickers_sample": [m.get("ticker", "") for m in all_markets[:20]] if all_markets else []
            }
        }
        
        print(json.dumps(response_data))
        
    except Exception as e:
        error_response = {
            "error": f"Error processing markets: {str(e)}",
            "markets": [],
            "debug": {
                "message": str(e),
                "patterns_tried": patterns_tried if 'patterns_tried' in locals() else []
            }
        }
        print(json.dumps(error_response))
        sys.exit(1)

if __name__ == "__main__":
    main()

