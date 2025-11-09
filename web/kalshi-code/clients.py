import requests
import base64
import time
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
from enum import Enum
import json

from requests.exceptions import HTTPError

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.exceptions import InvalidSignature

import websockets

class Environment(Enum):
    DEMO = "demo"
    PROD = "prod"

class KalshiBaseClient:
    """Base client class for interacting with the Kalshi API."""
    def __init__(
        self,
        key_id: str,
        private_key: rsa.RSAPrivateKey,
        environment: Environment = Environment.DEMO,
    ):
        """Initializes the client with the provided API key and private key.

        Args:
            key_id (str): Your Kalshi API key ID.
            private_key (rsa.RSAPrivateKey): Your RSA private key.
            environment (Environment): The API environment to use (DEMO or PROD).
        """
        self.key_id = key_id
        self.private_key = private_key
        self.environment = environment
        self.last_api_call = datetime.now()

        if self.environment == Environment.DEMO:
            self.HTTP_BASE_URL = "https://demo-api.kalshi.co"
            self.WS_BASE_URL = "wss://demo-api.kalshi.co"
        elif self.environment == Environment.PROD:
            self.HTTP_BASE_URL = "https://api.elections.kalshi.com"
            self.WS_BASE_URL = "wss://api.elections.kalshi.com"
        else:
            raise ValueError("Invalid environment")

    def request_headers(self, method: str, path: str) -> Dict[str, Any]:
        """Generates the required authentication headers for API requests."""
        current_time_milliseconds = int(time.time() * 1000)
        timestamp_str = str(current_time_milliseconds)

        # Remove query params from path
        path_parts = path.split('?')

        msg_string = timestamp_str + method + path_parts[0]
        signature = self.sign_pss_text(msg_string)

        headers = {
            "Content-Type": "application/json",
            "KALSHI-ACCESS-KEY": self.key_id,
            "KALSHI-ACCESS-SIGNATURE": signature,
            "KALSHI-ACCESS-TIMESTAMP": timestamp_str,
        }
        return headers

    def sign_pss_text(self, text: str) -> str:
        """Signs the text using RSA-PSS and returns the base64 encoded signature."""
        message = text.encode('utf-8')
        try:
            signature = self.private_key.sign(
                message,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.DIGEST_LENGTH
                ),
                hashes.SHA256()
            )
            return base64.b64encode(signature).decode('utf-8')
        except InvalidSignature as e:
            raise ValueError("RSA sign PSS failed") from e

class KalshiHttpClient(KalshiBaseClient):
    """Client for handling HTTP connections to the Kalshi API."""
    def __init__(
        self,
        key_id: str,
        private_key: rsa.RSAPrivateKey,
        environment: Environment = Environment.DEMO,
    ):
        super().__init__(key_id, private_key, environment)
        self.host = self.HTTP_BASE_URL
        self.exchange_url = "/trade-api/v2/exchange"
        self.markets_url = "/trade-api/v2/markets"
        self.portfolio_url = "/trade-api/v2/portfolio"

    def rate_limit(self) -> None:
        """Built-in rate limiter to prevent exceeding API rate limits.
        OPTIMIZED: Only sleeps if necessary, reducing overhead."""
        THRESHOLD_IN_MILLISECONDS = 100
        now = datetime.now()
        time_since_last_call = now - self.last_api_call
        threshold_in_seconds = THRESHOLD_IN_MILLISECONDS / 1000
        
        # Only sleep if we're calling too fast (optimization: check first, sleep only if needed)
        if time_since_last_call.total_seconds() < threshold_in_seconds:
            time.sleep(threshold_in_seconds - time_since_last_call.total_seconds())
        
        self.last_api_call = datetime.now()

    def raise_if_bad_response(self, response: requests.Response) -> None:
        """Raises an HTTPError if the response status code indicates an error."""
        if response.status_code not in range(200, 299):
            # Print response details for debugging
            try:
                error_body = response.json()
                print(f"API Error ({response.status_code}): {error_body}")
            except:
                print(f"API Error ({response.status_code}): {response.text}")
            response.raise_for_status()

    def post(self, path: str, body: dict) -> Any:
        """Performs an authenticated POST request to the Kalshi API."""
        self.rate_limit()
        response = requests.post(
            self.host + path,
            json=body,
            headers=self.request_headers("POST", path)
        )
        self.raise_if_bad_response(response)
        return response.json()

    def get(self, path: str, params: Dict[str, Any] = {}) -> Any:
        """Performs an authenticated GET request to the Kalshi API."""
        self.rate_limit()
        response = requests.get(
            self.host + path,
            headers=self.request_headers("GET", path),
            params=params
        )
        self.raise_if_bad_response(response)
        return response.json()

    def delete(self, path: str, params: Dict[str, Any] = {}) -> Any:
        """Performs an authenticated DELETE request to the Kalshi API."""
        self.rate_limit()
        response = requests.delete(
            self.host + path,
            headers=self.request_headers("DELETE", path),
            params=params
        )
        self.raise_if_bad_response(response)
        return response.json()

    def get_balance(self) -> Dict[str, Any]:
        """Retrieves the account balance."""
        return self.get(self.portfolio_url + '/balance')

    def get_exchange_status(self) -> Dict[str, Any]:
        """Retrieves the exchange status."""
        return self.get(self.exchange_url + "/status")

    def get_trades(
        self,
        ticker: Optional[str] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
        max_ts: Optional[int] = None,
        min_ts: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Retrieves trades based on provided filters."""
        params = {
            'ticker': ticker,
            'limit': limit,
            'cursor': cursor,
            'max_ts': max_ts,
            'min_ts': min_ts,
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}
        return self.get(self.markets_url + '/trades', params=params)

    def get_market(self, market_id: str, silent: bool = False) -> Dict[str, Any]:
        """Retrieves detailed information about a specific market.
        
        Args:
            market_id: The market ID to fetch
            silent: If True, don't print errors for 404 responses
        """
        if silent:
            # Use a version that doesn't print errors
            self.rate_limit()
            response = requests.get(
                self.host + self.markets_url + f'/{market_id}',
                headers=self.request_headers("GET", self.markets_url + f'/{market_id}'),
            )
            if response.status_code == 404:
                return {}
            if response.status_code not in range(200, 299):
                return {}
            return response.json()
        else:
            return self.get(self.markets_url + f'/{market_id}')

    def get_markets(
        self,
        ticker: Optional[str] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Retrieves markets based on provided filters."""
        params = {
            'ticker': ticker,
            'limit': limit,
            'cursor': cursor,
            'status': status,
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}
        return self.get(self.markets_url, params=params)

class KalshiWebSocketClient(KalshiBaseClient):
    """Client for handling WebSocket connections to the Kalshi API."""
    def __init__(
        self,
        key_id: str,
        private_key: rsa.RSAPrivateKey,
        environment: Environment = Environment.DEMO,
        http_client: Optional['KalshiHttpClient'] = None,
    ):
        super().__init__(key_id, private_key, environment)
        self.ws = None
        self.url_suffix = "/trade-api/ws/v2"
        self.message_id = 1  # Add counter for message IDs
        self.http_client = http_client
        self.market_cache = {}  # Cache market details to avoid repeated API calls
        self.ticker_cache = {}  # Cache parsed tickers for performance

    async def connect(self):
        """Establishes a WebSocket connection using authentication."""
        host = self.WS_BASE_URL + self.url_suffix
        auth_headers = self.request_headers("GET", self.url_suffix)
        async with websockets.connect(host, additional_headers=auth_headers) as websocket:
            self.ws = websocket
            await self.on_open()
            await self.handler()

    async def on_open(self):
        """Callback when WebSocket connection is opened."""
        print("WebSocket connection opened.")
        await self.subscribe_to_tickers()

    async def subscribe_to_tickers(self):
        """Subscribe to ticker updates for all markets."""
        subscription_message = {
            "id": self.message_id,
            "cmd": "subscribe",
            "params": {
                "channels": ["ticker"]
            }
        }
        await self.ws.send(json.dumps(subscription_message))
        self.message_id += 1

    async def handler(self):
        """Handle incoming messages."""
        try:
            async for message in self.ws:
                await self.on_message(message)
        except websockets.ConnectionClosed as e:
            await self.on_close(e.code, e.reason)
        except Exception as e:
            await self.on_error(e)

    def parse_ticker(self, ticker: str) -> Dict[str, str]:
        """Parse EPL ticker to extract game information. Uses caching for performance."""
        # Check cache first
        if ticker in self.ticker_cache:
            return self.ticker_cache[ticker].copy()
        
        # Team abbreviation mapping
        team_names = {
            "CFC": "Chelsea", "WOL": "Wolves", "BOU": "Bournemouth", 
            "AVL": "Aston Villa", "LIV": "Liverpool", "LFC": "Liverpool",  # LFC is also used
            "MCI": "Manchester City", "ARS": "Arsenal", "TOT": "Tottenham", "CHE": "Chelsea",
            "MUN": "Manchester United", "NEW": "Newcastle", 
            "BHA": "Brighton", "BRI": "Brighton", "BHAH": "Brighton",  # Various Brighton codes
            "CRY": "Crystal Palace", "PAL": "Crystal Palace", "CP": "Crystal Palace",  # Crystal Palace variations
            "EVE": "Everton", "FUL": "Fulham",
            "LEI": "Leicester", "LEE": "Leeds", "SOU": "Southampton",
            "WHU": "West Ham", "BRE": "Brentford", "NFO": "Nottingham Forest",
            "BUR": "Burnley", "SHU": "Sheffield United", "LUT": "Luton"
        }
        
        # Example: KXEPLGAME-25NOV08CFCWOL-CFC
        # Format: KXEPLGAME-DATETEAMS-PROP
        # The date is typically 7 chars: 25NOV08 (day + MON + day)
        parts = ticker.split("-")
        result = {"ticker": ticker, "date": "", "date_formatted": "", 
                 "team1": "", "team1_full": "", "team2": "", "team2_full": "", 
                 "prop": "", "prop_full": "", "bet_description": ""}
        
        if len(parts) >= 3:
            # Second part contains date + teams: "25NOV08CFCWOL"
            date_teams = parts[1]
            
            # Extract date (first 7 characters: 25NOV08)
            # Format is: YYMMMDD (year, month, day) - e.g., "25NOV08" = Nov 8, 2025
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
                    # If year suffix is 00-30, assume 2000-2030, otherwise assume 1900s
                    if year_suffix_int <= 30:
                        year = 2000 + year_suffix_int
                    else:
                        year = 1900 + year_suffix_int
                    
                    month_map = {"JAN": "Jan", "FEB": "Feb", "MAR": "Mar", 
                               "APR": "Apr", "MAY": "May", "JUN": "Jun",
                               "JUL": "Jul", "AUG": "Aug", "SEP": "Sep",
                               "OCT": "Oct", "NOV": "Nov", "DEC": "Dec"}
                    month_name = month_map.get(month, month)
                    result["date_formatted"] = f"{month_name} {int(day)}, {year}"
                except Exception as e:
                    # Fallback: try alternative parsing or use current year
                    try:
                        from datetime import datetime
                        # Try YYMMMDD format
                        year_suffix = date_str[:2]
                        month = date_str[2:5]
                        day = date_str[5:7] if len(date_str) >= 7 else date_str[5:]
                        
                        year_suffix_int = int(year_suffix)
                        if year_suffix_int <= 30:
                            year = 2000 + year_suffix_int
                        else:
                            year = 1900 + year_suffix_int
                        
                        month_map = {"JAN": "Jan", "FEB": "Feb", "MAR": "Mar", 
                                   "APR": "Apr", "MAY": "May", "JUN": "Jun",
                                   "JUL": "Jul", "AUG": "Aug", "SEP": "Sep",
                                   "OCT": "Oct", "NOV": "Nov", "DEC": "Dec"}
                        month_name = month_map.get(month, month)
                        result["date_formatted"] = f"{month_name} {int(day)}, {year}"
                    except:
                        result["date_formatted"] = date_str
            
            # Extract teams (remaining after date)
            teams_str = date_teams[7:] if len(date_teams) >= 7 else date_teams  # "CFCWOL"
            
            # Split teams (usually 3 letters each)
            if len(teams_str) >= 6:
                team1_code = teams_str[:3]
                team2_code = teams_str[3:6]
                result["team1"] = team1_code
                result["team2"] = team2_code
                result["team1_full"] = team_names.get(team1_code, team1_code)
                result["team2_full"] = team_names.get(team2_code, team2_code)
                
                # If team names not found, try alternative parsing
                if result["team1_full"] == team1_code or result["team2_full"] == team2_code:
                    # Try swapping teams (sometimes order might be different)
                    team1_swapped = team_names.get(team2_code, team2_code)
                    team2_swapped = team_names.get(team1_code, team1_code)
                    if team1_swapped != team2_code or team2_swapped != team1_code:
                        if team1_swapped != team2_code:
                            result["team1"] = team2_code
                            result["team1_full"] = team1_swapped
                        if team2_swapped != team1_code:
                            result["team2"] = team1_code
                            result["team2_full"] = team2_swapped
            elif len(teams_str) >= 3:
                result["team1"] = teams_str[:3]
                result["team1_full"] = team_names.get(teams_str[:3], teams_str[:3])
            
            # Third part is the prop/outcome
            if len(parts) >= 3:
                prop_code = parts[2] if len(parts) > 2 else ""
                if prop_code:
                    if prop_code in ["TIE", "DRAW"]:
                        result["prop"] = prop_code
                        result["prop_full"] = "Tie/Draw"
                    elif prop_code in team_names:
                        result["prop"] = prop_code
                        result["prop_full"] = team_names[prop_code] + " Wins"
                    else:
                        result["prop"] = prop_code
                        result["prop_full"] = prop_code
                    
                    # Build bet description
                    if result["team1_full"] and result["team2_full"]:
                        result["bet_description"] = f"{result['prop_full']} ({result['team1_full']} vs {result['team2_full']})"
                    elif result["team1_full"]:
                        result["bet_description"] = f"{result['prop_full']} ({result['team1_full']} game)"
        
        # Cache the result
        self.ticker_cache[ticker] = result.copy()
        return result

    async def get_market_details(self, market_id: str) -> Dict[str, Any]:
        """Get market details, using cache if available."""
        if market_id in self.market_cache:
            return self.market_cache[market_id]
        
        if self.http_client:
            try:
                # Use silent mode to avoid printing 404 errors
                market_data = self.http_client.get_market(market_id, silent=True)
                if not market_data:
                    # Cache empty result to avoid repeated failed requests
                    self.market_cache[market_id] = {}
                    return {}
                if "market" in market_data:
                    self.market_cache[market_id] = market_data["market"]
                    return market_data["market"]
                elif market_data:  # If response is not empty but doesn't have "market" key
                    self.market_cache[market_id] = market_data
                    return market_data
            except Exception:
                # Silently handle any errors (network issues, etc.)
                self.market_cache[market_id] = {}
                return {}
        
        return {}

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
                    
                    # Build clean, organized output
                    print("\n" + "─" * 70)
                    
                    # Ticker
                    print(f"📋 Ticker: {ticker}")
                    
                    # Date
                    if ticker_info["date_formatted"]:
                        print(f"📅 Date: {ticker_info['date_formatted']}")
                    elif ticker_info["date"]:
                        print(f"📅 Date: {ticker_info['date']}")
                    
                    # Teams
                    if ticker_info["team1_full"] and ticker_info["team2_full"]:
                        print(f"⚽ Teams: {ticker_info['team1_full']} vs {ticker_info['team2_full']}")
                    elif ticker_info["team1_full"]:
                        print(f"⚽ Team: {ticker_info['team1_full']}")
                    elif ticker_info["team1"]:
                        print(f"⚽ Team: {ticker_info['team1']}")
                    
                    # Bet/Prop
                    if ticker_info["bet_description"]:
                        print(f"🎯 Bet: {ticker_info['bet_description']}")
                    elif ticker_info["prop_full"]:
                        print(f"🎯 Bet: {ticker_info['prop_full']}")
                    elif ticker_info["prop"]:
                        print(f"🎯 Bet: {ticker_info['prop']}")
                    
                    # Odds and Pricing
                    print(f"\n💰 Odds & Pricing:")
                    print(f"   Current Price: ${price}")
                    print(f"   Bid: ${yes_bid}  |  Ask: ${yes_ask}")
                    
                    # Calculate implied probability from price
                    try:
                        price_float = float(price) if price != "N/A" else None
                        if price_float:
                            prob = price_float * 100
                            print(f"   Implied Probability: {prob:.1f}%")
                    except:
                        pass
                    
                    # Trading Stats
                    print(f"\n📊 Trading Stats:")
                    print(f"   Volume: {volume:,}")
                    print(f"   Open Interest: {open_interest:,}")
                    
                    print("─" * 70)
        except json.JSONDecodeError:
            # If it's not JSON, print as is (might be connection messages)
            if "EPLGAME" in message:
                print("EPL Game Update:", message)

    async def on_error(self, error):
        """Callback for handling errors."""
        print("WebSocket error:", error)

    async def on_close(self, close_status_code, close_msg):
        """Callback when WebSocket connection is closed."""
        print("WebSocket connection closed with code:", close_status_code, "and message:", close_msg)