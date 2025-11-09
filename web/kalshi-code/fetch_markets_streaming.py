#!/usr/bin/env python3
"""
Streaming market fetcher - outputs markets as they're found via WebSocket.
Sends initial batch after a few seconds, then continues streaming new markets.
"""
import os
import sys
import json
import time
import asyncio
import urllib.parse
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization

from clients import KalshiHttpClient, KalshiWebSocketClient, Environment

# Load environment variables
load_dotenv()
env = Environment.PROD
KEYID = os.getenv('DEMO_KEYID') if env == Environment.DEMO else os.getenv('PROD_KEYID')
KEYFILE = os.getenv('DEMO_KEYFILE') if env == Environment.DEMO else os.getenv('PROD_KEYFILE')

# Check credentials
if not KEYID or not KEYFILE:
    error_response = {
        "type": "error",
        "message": "API credentials not found. Check your .env file.",
        "timestamp": time.time()
    }
    print(json.dumps(error_response), flush=True)
    sys.exit(1)

try:
    with open(KEYFILE, "rb") as key_file:
        private_key = serialization.load_pem_private_key(
            key_file.read(),
            password=None
        )
except Exception as e:
    error_response = {
        "type": "error",
        "message": f"Error loading private key: {str(e)}",
        "timestamp": time.time()
    }
    print(json.dumps(error_response), flush=True)
    sys.exit(1)

# Initialize clients
http_client = KalshiHttpClient(
    key_id=KEYID,
    private_key=private_key,
    environment=env
)

# Store collected markets
collected_markets = {}
seen_tickers = set()
start_time = time.time()
INITIAL_BATCH_DELAY = 3  # Send first batch after 3 seconds
INACTIVITY_TIMEOUT = 120  # Stop if no new markets found for 2 minutes (120 seconds)

# Track last time a new market was found
last_new_market_time = None
scraper_stopped = False

def extract_base_ticker(ticker: str) -> str:
    """Extract base ticker from full ticker (removes the prop/outcome part).
    Example: KXEPLGAME-25NOV23ARSTOT-ARS -> KXEPLGAME-25NOV23ARSTOT
    """
    parts = ticker.split('-')
    if len(parts) >= 2:
        # Return first two parts (prefix + date+teams)
        return '-'.join(parts[:2])
    return ticker

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

async def find_related_markets_streaming(http_client, base_ticker: str, seen_tickers: set, team_codes: list) -> list:
    """Find related markets for the same game by searching for base ticker with different props.
    Returns list of market dictionaries.
    """
    related_markets = []
    
    if not http_client:
        return related_markets
    
    # Common prop codes to search for
    common_props = ["TIE", "DRAW"] + team_codes
    
    # Try searching with base ticker pattern
    try:
        # Try searching with just the base ticker (first two parts)
        response = http_client.get_markets(ticker=base_ticker, limit=100, status="open")
        if "markets" in response:
            for market in response["markets"]:
                ticker = market.get("ticker", "")
                if ticker and ticker not in seen_tickers:
                    # Check if it's a related market (same base)
                    if ticker.startswith(base_ticker + "-"):
                        related_markets.append(market)
    except Exception:
        pass
    
    # Also try searching for each common prop
    for prop in common_props:
        if prop in base_ticker:  # Skip if prop is already in base
            continue
        try:
            search_ticker = f"{base_ticker}-{prop}"
            response = http_client.get_markets(ticker=search_ticker, limit=10, status="open")
            if "markets" in response:
                for market in response["markets"]:
                    ticker = market.get("ticker", "")
                    if ticker and ticker not in seen_tickers:
                        if ticker.startswith(base_ticker + "-"):
                            related_markets.append(market)
        except Exception:
            continue
    
    return related_markets

class StreamingMarketCollector(KalshiWebSocketClient):
    """WebSocket client that streams markets as they're found."""
    
    async def on_open(self):
        """Callback when WebSocket connection is opened."""
        global last_new_market_time
        last_new_market_time = time.time()  # Initialize with current time
        status_msg = {
            "type": "status",
            "message": "WebSocket connection opened, collecting markets...",
            "timestamp": time.time()
        }
        print(json.dumps(status_msg), flush=True)
        await self.subscribe_to_tickers()
    
    async def on_message(self, message):
        """Callback for handling incoming messages."""
        try:
            data = json.loads(message)
            if data.get("type") == "ticker" and "msg" in data:
                msg = data["msg"]
                ticker = msg.get("market_ticker", "")
                market_id = msg.get("market_id", "")
                
                # OPTIMIZED EPL detection - check most common patterns first
                ticker_upper = ticker.upper()
                is_epl = (
                    ticker_upper.startswith("KXEPL") or  # Most common, check first
                    ticker_upper.startswith("EPL") or
                    "KXEPLGAME" in ticker_upper or
                    "EPLGAME" in ticker_upper or
                    ("EPL" in ticker_upper and "GAME" in ticker_upper)
                )
                
                if is_epl and ticker not in seen_tickers:
                    global last_new_market_time, scraper_stopped
                    
                    # Update last new market time
                    last_new_market_time = time.time()
                    
                    seen_tickers.add(ticker)
                    
                    # Extract base ticker to find related markets
                    base_ticker = extract_base_ticker(ticker)
                    
                    price = msg.get("price_dollars", "N/A")
                    yes_bid = msg.get("yes_bid_dollars", "N/A")
                    yes_ask = msg.get("yes_ask_dollars", "N/A")
                    volume = msg.get("volume", 0)
                    open_interest = msg.get("open_interest", 0)
                    
                    # Parse ticker for team names (cached in base class)
                    ticker_info = self.parse_ticker(ticker)
                    
                    # OPTIMIZATION: Skip market details HTTP call for initial streaming
                    # Market details are not critical for initial display and slow things down
                    # Only fetch if really needed (can be done later via separate call)
                    market_details = {}
                    # Commented out for speed - uncomment if market details are critical
                    # if market_id and self.http_client:
                    #     market_details = await self.get_market_details(market_id)
                    
                    # Get market title for filtering
                    market_title = market_details.get("title", ticker_info.get("bet_description", ticker)) if market_details else ticker_info.get("bet_description", ticker)
                    
                    # Filter out generic "team1 vs team2" markets (without specific prop/outcome)
                    if is_generic_vs_market(ticker_info, market_title):
                        return
                    
                    # Only include match result markets (Team Wins, Tie/Draw)
                    # Exclude other prop bets like over/under, first goal, etc.
                    if not is_match_result_market(ticker_info, ticker):
                        return
                    
                    # Convert price to number
                    price_num = None
                    if price != "N/A":
                        try:
                            price_num = float(price)
                        except:
                            pass
                    
                    yes_bid_num = None
                    if yes_bid != "N/A":
                        try:
                            yes_bid_num = float(yes_bid)
                        except:
                            pass
                    
                    yes_ask_num = None
                    if yes_ask != "N/A":
                        try:
                            yes_ask_num = float(yes_ask)
                        except:
                            pass
                    
                    no_price = None
                    if price_num is not None:
                        no_price = 1.0 - price_num
                    
                    # Build market object
                    market_obj = {
                        "market_id": market_id,
                        "ticker": ticker,
                        "ticker_info": ticker_info,
                        "title": market_title,
                        "subtitle": market_details.get("subtitle", "") if market_details else "",
                        "status": market_details.get("status", "open") if market_details else "open",
                        "yes_price": price_num if price_num is not None else 0,
                        "no_price": no_price if no_price is not None else 0,
                        "volume": volume,
                        "open_interest": open_interest,
                        # Use ticker for URL - Kalshi uses /markets/kxeplgame/english-premier-league-game/{ticker}
                        # Remove the prop part (last segment) and convert to lowercase
                        # Format: KXEPLGAME-25NOV09MCILFC-MCI -> kxeplgame-25nov09mcilfc
                        "market_url": (
                            f"https://kalshi.com/markets/kxeplgame/english-premier-league-game/{'-'.join(ticker.split('-')[:2]).lower()}"
                            if ticker and len(ticker.split('-')) >= 2
                            else None
                        )
                    }
                    
                    # Store market
                    collected_markets[ticker] = market_obj
                    
                    # Send individual market update
                    update_msg = {
                        "type": "market_update",
                        "market": market_obj,
                        "timestamp": time.time()
                    }
                    print(json.dumps(update_msg), flush=True)
                    
                    # Find and send related markets for the same game
                    # Get team codes from ticker info
                    team_codes = []
                    if ticker_info.get("team1"):
                        team_codes.append(ticker_info["team1"])
                    if ticker_info.get("team2"):
                        team_codes.append(ticker_info["team2"])
                    
                    # Find related markets (other outcomes for same game)
                    try:
                        related = await find_related_markets_streaming(self.http_client, base_ticker, seen_tickers, team_codes)
                        for related_market in related:
                            related_ticker = related_market.get("ticker", "")
                            if related_ticker and related_ticker not in seen_tickers:
                                seen_tickers.add(related_ticker)
                                
                                # Process related market similar to main market
                                related_ticker_info = self.parse_ticker(related_ticker)
                                related_market_id = related_market.get("market_id", "")
                                related_market_title = related_market.get("title", related_ticker_info.get("bet_description", related_ticker))
                                
                                # Filter out generic "team1 vs team2" markets (without specific prop/outcome)
                                if is_generic_vs_market(related_ticker_info, related_market_title):
                                    continue
                                
                                # Only include match result markets (Team Wins, Tie/Draw)
                                # Exclude other prop bets like over/under, first goal, etc.
                                if not is_match_result_market(related_ticker_info, related_ticker):
                                    continue
                                
                                related_price = related_market.get("yes_bid_dollars", related_market.get("yes_bid", 0))
                                if related_price and related_price > 1:
                                    related_price = related_price / 100
                                
                                related_no_price = 1.0 - related_price if related_price else 0
                                
                                related_market_obj = {
                                    "market_id": related_market_id,
                                    "ticker": related_ticker,
                                    "ticker_info": related_ticker_info,
                                    "title": related_market_title,
                                    "subtitle": related_market.get("subtitle", ""),
                                    "status": related_market.get("status", "open"),
                                    "yes_price": related_price if related_price else 0,
                                    "no_price": related_no_price if related_no_price else 0,
                                    "volume": related_market.get("volume", 0),
                                    "open_interest": related_market.get("open_interest", 0),
                                    "market_url": (
                                        f"https://kalshi.com/markets/kxeplgame/english-premier-league-game/{'-'.join(related_ticker.split('-')[:2]).lower()}"
                                        if related_ticker and len(related_ticker.split('-')) >= 2
                                        else None
                                    )
                                }
                                
                                collected_markets[related_ticker] = related_market_obj
                                
                                # Send related market update
                                related_update_msg = {
                                    "type": "market_update",
                                    "market": related_market_obj,
                                    "timestamp": time.time()
                                }
                                print(json.dumps(related_update_msg), flush=True)
                    except Exception:
                        # Silently continue if related market search fails
                        pass
                    
        except json.JSONDecodeError:
            pass
        except Exception as e:
            pass

async def run_streaming_collector():
    """Run WebSocket connection and send periodic batches."""
    global last_new_market_time, scraper_stopped
    
    ws_client = StreamingMarketCollector(
        key_id=KEYID,
        private_key=private_key,
        environment=env,
        http_client=http_client
    )
    
    # Create a task to run the WebSocket connection
    async def connect_task():
        try:
            await ws_client.connect()
        except Exception as e:
            pass
    
    # Background task to check for inactivity timeout
    async def check_inactivity_timeout():
        global last_new_market_time, scraper_stopped
        
        # Wait for initial batch delay before starting to check
        await asyncio.sleep(INITIAL_BATCH_DELAY + 5)  # Give a bit of buffer after initial batch
        
        while not scraper_stopped:
            await asyncio.sleep(10)  # Check every 10 seconds
            
            if last_new_market_time is None:
                # If we haven't found any markets yet, wait a bit more
                continue
            
            time_since_last_market = time.time() - last_new_market_time
            
            if time_since_last_market >= INACTIVITY_TIMEOUT:
                scraper_stopped = True
                timeout_msg = {
                    "type": "status",
                    "message": f"No new markets found for {INACTIVITY_TIMEOUT} seconds. Stopping scraper.",
                    "timestamp": time.time(),
                    "inactivity_seconds": round(time_since_last_market, 2)
                }
                print(json.dumps(timeout_msg), flush=True)
                
                # Close the WebSocket connection
                if ws_client.ws:
                    try:
                        await ws_client.ws.close()
                    except:
                        pass
                
                # Send final batch
                final_batch = {
                    "type": "final_batch",
                    "markets": list(collected_markets.values()),
                    "total_collected": len(collected_markets),
                    "timestamp": time.time(),
                    "stopped_reason": "inactivity_timeout"
                }
                print(json.dumps(final_batch), flush=True)
                break
    
    # Run connection in background
    connection_task = asyncio.create_task(connect_task())
    
    # Run inactivity checker in background
    inactivity_task = asyncio.create_task(check_inactivity_timeout())
    
    # Wait for initial batch delay
    await asyncio.sleep(INITIAL_BATCH_DELAY)
    
    # Send initial batch
    if collected_markets:
        initial_batch = {
            "type": "initial_batch",
            "markets": list(collected_markets.values()),
            "timestamp": time.time()
        }
        print(json.dumps(initial_batch), flush=True)
    
    # Wait for either connection to close or inactivity timeout
    try:
        # Wait for connection task or inactivity task to complete
        done, pending = await asyncio.wait(
            [connection_task, inactivity_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
                
    except (asyncio.CancelledError, KeyboardInterrupt):
        # Process is being terminated
        scraper_stopped = True
        pass
    
    # If we get here and haven't sent final batch yet, send it
    if not scraper_stopped:
        scraper_stopped = True
        final_batch = {
            "type": "final_batch",
            "markets": list(collected_markets.values()),
            "total_collected": len(collected_markets),
            "timestamp": time.time()
        }
        print(json.dumps(final_batch), flush=True)

# Run the streaming collector
try:
    asyncio.run(run_streaming_collector())
except KeyboardInterrupt:
    pass
except Exception as e:
    error_response = {
        "type": "error",
        "message": f"Error running WebSocket: {str(e)}",
        "timestamp": time.time()
    }
    print(json.dumps(error_response), flush=True)
    sys.exit(1)

