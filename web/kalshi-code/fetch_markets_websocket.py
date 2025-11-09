#!/usr/bin/env python3
"""
Fetch markets using WebSocket - runs for 30 seconds and collects all EPL markets.
This uses the same approach as main.py but collects data and outputs JSON.
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

# Initialize clients
http_client = KalshiHttpClient(
    key_id=KEYID,
    private_key=private_key,
    environment=env
)

# Store collected markets
collected_markets = {}
start_time = time.time()
RUN_DURATION = 10  # Run for 10 seconds - collects all active EPL markets via WebSocket updates

class MarketCollectorWebSocketClient(KalshiWebSocketClient):
    """WebSocket client that collects market data for a limited time."""
    
    async def on_open(self):
        """Callback when WebSocket connection is opened."""
        await self.subscribe_to_tickers()
    
    async def on_message(self, message):
        """Callback for handling incoming messages."""
        try:
            data = json.loads(message)
            # Filter for EPL games only
            if data.get("type") == "ticker" and "msg" in data:
                msg = data["msg"]
                ticker = msg.get("market_ticker", "")
                market_id = msg.get("market_id", "")
                
                if "EPLGAME" in ticker:
                    price = msg.get("price_dollars", "N/A")
                    yes_bid = msg.get("yes_bid_dollars", "N/A")
                    yes_ask = msg.get("yes_ask_dollars", "N/A")
                    volume = msg.get("volume", 0)
                    open_interest = msg.get("open_interest", 0)
                    
                    # Parse ticker for team names
                    ticker_info = self.parse_ticker(ticker)
                    
                    # Get market details if HTTP client is available
                    market_details = {}
                    if market_id and self.http_client:
                        market_details = await self.get_market_details(market_id)
                    
                    # Use ticker as key to avoid duplicates (keep latest data)
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
                    
                    # Calculate no price (1 - yes price)
                    no_price = None
                    if price_num is not None:
                        no_price = 1.0 - price_num
                    
                    # Build market object
                    market_obj = {
                        "market_id": market_id,
                        "ticker": ticker,
                        "ticker_info": ticker_info,
                        "title": market_details.get("title", ticker_info.get("bet_description", ticker)) if market_details else ticker_info.get("bet_description", ticker),
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
                    
                    # Store/update market (keep latest data)
                    collected_markets[ticker] = market_obj
                    
        except json.JSONDecodeError:
            pass
        except Exception as e:
            # Silently continue on errors
            pass

async def run_websocket_with_timeout():
    """Run WebSocket connection for a limited time."""
    ws_client = MarketCollectorWebSocketClient(
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
    
    # Run connection in background
    connection_task = asyncio.create_task(connect_task())
    
    # Wait for the specified duration
    await asyncio.sleep(RUN_DURATION)
    
    # Cancel the connection task
    connection_task.cancel()
    try:
        await connection_task
    except asyncio.CancelledError:
        pass

# Run the WebSocket collector
try:
    asyncio.run(run_websocket_with_timeout())
except KeyboardInterrupt:
    pass
except Exception as e:
    error_response = {
        "error": f"Error running WebSocket: {str(e)}",
        "markets": []
    }
    print(json.dumps(error_response))
    sys.exit(1)

# Convert collected markets to list
markets_list = list(collected_markets.values())

# Build response
response_data = {
    "error": None,
    "markets": markets_list,
    "debug": {
        "markets_collected": len(markets_list),
        "collection_duration_seconds": RUN_DURATION,
        "sample_tickers": [m["ticker"] for m in markets_list[:10]]
    }
}

print(json.dumps(response_data))

