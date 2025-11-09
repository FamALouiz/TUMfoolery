#!/usr/bin/env python3
"""
WebSocket stream script that outputs EPL market updates as JSON to stdout.
This script is designed to be run as a subprocess and stream data via Server-Sent Events.
"""
import os
import sys
import json
import time
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
import asyncio

from clients import KalshiHttpClient, KalshiWebSocketClient, Environment

# Load environment variables
load_dotenv()
env = Environment.PROD  # toggle environment here (try PROD if DEMO doesn't work)
KEYID = os.getenv('DEMO_KEYID') if env == Environment.DEMO else os.getenv('PROD_KEYID')
KEYFILE = os.getenv('DEMO_KEYFILE') if env == Environment.DEMO else os.getenv('PROD_KEYFILE')

# Debug: Check if credentials are loaded
if not KEYID:
    error_msg = {
        "type": "error",
        "message": f"API Key ID not found. Check your .env file for {'DEMO_KEYID' if env == Environment.DEMO else 'PROD_KEYID'}"
    }
    print(json.dumps(error_msg), flush=True)
    sys.exit(1)

if not KEYFILE:
    error_msg = {
        "type": "error",
        "message": f"Key file path not found. Check your .env file for {'DEMO_KEYFILE' if env == Environment.DEMO else 'PROD_KEYFILE'}"
    }
    print(json.dumps(error_msg), flush=True)
    sys.exit(1)

try:
    with open(KEYFILE, "rb") as key_file:
        private_key = serialization.load_pem_private_key(
            key_file.read(),
            password=None
        )
except FileNotFoundError:
    error_msg = {
        "type": "error",
        "message": f"Private key file not found at {KEYFILE}"
    }
    print(json.dumps(error_msg), flush=True)
    sys.exit(1)
except Exception as e:
    error_msg = {
        "type": "error",
        "message": f"Error loading private key: {str(e)}"
    }
    print(json.dumps(error_msg), flush=True)
    sys.exit(1)

# Initialize the HTTP client
http_client = KalshiHttpClient(
    key_id=KEYID,
    private_key=private_key,
    environment=env
)

# Create a custom WebSocket client that outputs JSON
class StreamingWebSocketClient(KalshiWebSocketClient):
    """WebSocket client that outputs JSON updates to stdout."""
    
    async def on_open(self):
        """Callback when WebSocket connection is opened."""
        status_msg = {
            "type": "status",
            "message": "WebSocket connection opened",
            "timestamp": time.time()
        }
        print(json.dumps(status_msg), flush=True)
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
                
                # More comprehensive EPL detection
                ticker_upper = ticker.upper()
                is_epl = (
                    "KXEPLGAME" in ticker_upper or
                    "EPLGAME" in ticker_upper or
                    ("EPL" in ticker_upper and "GAME" in ticker_upper) or
                    ticker_upper.startswith("KXEPL") or 
                    ticker_upper.startswith("EPL")
                )
                
                if is_epl:
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
                    
                    # Build structured update object
                    update = {
                        "type": "market_update",
                        "timestamp": time.time(),
                        "data": {
                            "ticker": ticker,
                            "market_id": market_id,
                            "date": ticker_info.get("date", ""),
                            "date_formatted": ticker_info.get("date_formatted", ""),
                            "team1": ticker_info.get("team1", ""),
                            "team1_full": ticker_info.get("team1_full", ""),
                            "team2": ticker_info.get("team2", ""),
                            "team2_full": ticker_info.get("team2_full", ""),
                            "prop": ticker_info.get("prop", ""),
                            "prop_full": ticker_info.get("prop_full", ""),
                            "bet_description": ticker_info.get("bet_description", ""),
                            "pricing": {
                                "current_price": price if price != "N/A" else None,
                                "yes_bid": yes_bid if yes_bid != "N/A" else None,
                                "yes_ask": yes_ask if yes_ask != "N/A" else None,
                                "implied_probability": float(price) * 100 if price != "N/A" else None
                            },
                            "trading_stats": {
                                "volume": volume,
                                "open_interest": open_interest
                            },
                            "market_details": market_details if market_details else None
                        }
                    }
                    
                    # Output as JSON to stdout
                    print(json.dumps(update), flush=True)
        except json.JSONDecodeError:
            # If it's not JSON, ignore (might be connection messages)
            pass
        except Exception as e:
            error_msg = {
                "type": "error",
                "message": f"Error processing message: {str(e)}",
                "timestamp": time.time()
            }
            print(json.dumps(error_msg), flush=True)
    
    async def on_error(self, error):
        """Callback for handling errors."""
        error_msg = {
            "type": "error",
            "message": f"WebSocket error: {str(error)}",
            "timestamp": time.time()
        }
        print(json.dumps(error_msg), flush=True)
    
    async def on_close(self, close_status_code, close_msg):
        """Callback when WebSocket connection is closed."""
        status_msg = {
            "type": "status",
            "message": f"WebSocket connection closed with code: {close_status_code}",
            "close_code": close_status_code,
            "close_reason": close_msg,
            "timestamp": time.time()
        }
        print(json.dumps(status_msg), flush=True)

# Initialize the WebSocket client
ws_client = StreamingWebSocketClient(
    key_id=KEYID,
    private_key=private_key,
    environment=env,
    http_client=http_client
)

# Send initial connection status
initial_status = {
    "type": "status",
    "message": "Initializing WebSocket connection...",
    "timestamp": time.time()
}
print(json.dumps(initial_status), flush=True)

# Connect via WebSocket
try:
    asyncio.run(ws_client.connect())
except KeyboardInterrupt:
    # Handle graceful shutdown
    shutdown_msg = {
        "type": "status",
        "message": "WebSocket connection terminated by user",
        "timestamp": time.time()
    }
    print(json.dumps(shutdown_msg), flush=True)
except Exception as e:
    error_msg = {
        "type": "error",
        "message": f"Fatal error: {str(e)}",
        "timestamp": time.time()
    }
    print(json.dumps(error_msg), flush=True)
    sys.exit(1)

