import os
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
import asyncio

from clients import KalshiHttpClient, KalshiWebSocketClient, Environment

# Load environment variables
load_dotenv()
env = Environment.PROD # toggle environment here (try PROD if DEMO doesn't work)
KEYID = os.getenv('DEMO_KEYID') if env == Environment.DEMO else os.getenv('PROD_KEYID')
KEYFILE = os.getenv('DEMO_KEYFILE') if env == Environment.DEMO else os.getenv('PROD_KEYFILE')

# Debug: Check if credentials are loaded
if not KEYID:
    raise ValueError(f"API Key ID not found. Check your .env file for {'DEMO_KEYID' if env == Environment.DEMO else 'PROD_KEYID'}")
if not KEYFILE:
    raise ValueError(f"Key file path not found. Check your .env file for {'DEMO_KEYFILE' if env == Environment.DEMO else 'PROD_KEYFILE'}")
print(f"Using Key ID: {KEYID[:8]}... (truncated)")
print(f"Using Key File: {KEYFILE}")

try:
    with open(KEYFILE, "rb") as key_file:
        private_key = serialization.load_pem_private_key(
            key_file.read(),
            password=None  # Provide the password if your key is encrypted
        )
except FileNotFoundError:
    raise FileNotFoundError(f"Private key file not found at {KEYFILE}")
except Exception as e:
    raise Exception(f"Error loading private key: {str(e)}")

# Initialize the HTTP client
client = KalshiHttpClient(
    key_id=KEYID,
    private_key=private_key,
    environment=env
)

# Get account balance
balance = client.get_balance()
print("Balance:", balance)

# Initialize the WebSocket client (pass HTTP client for market details)
ws_client = KalshiWebSocketClient(
    key_id=KEYID,
    private_key=private_key,
    environment=env,
    http_client=client  # Pass HTTP client to fetch market details
)

# Connect via WebSocket
asyncio.run(ws_client.connect())