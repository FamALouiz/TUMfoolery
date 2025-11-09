# kalshi-starter-code-python
Example python code for accessing api-authenticated endpoints on [Kalshi](https://kalshi.com). This is not an SDK. 

## Installation 
Install requirements.txt in a virtual environment of your choice and execute main.py from within the repo.

```
pip install -r requirements.txt
python main.py
```

## Real-time WebSocket Streaming

The `websocket_stream.py` script connects to the Kalshi WebSocket API and streams EPL (English Premier League) game market updates in real-time. It outputs JSON-formatted updates to stdout, making it suitable for integration with Server-Sent Events (SSE) or other streaming protocols.

### Usage

The script is designed to be run as a subprocess by the Next.js API route (`/api/kalshi/stream`). It automatically:
- Connects to the Kalshi WebSocket API
- Filters for EPL game markets (tickers containing "EPLGAME")
- Parses ticker information to extract team names, dates, and betting props
- Outputs structured JSON updates to stdout

### Environment Variables

Make sure your `.env` file in the `kalshi-code` directory contains:
- `DEMO_KEYID` or `PROD_KEYID`: Your Kalshi API key ID
- `DEMO_KEYFILE` or `PROD_KEYFILE`: Path to your RSA private key file

The script uses `PROD` environment by default. To switch to demo, change `env = Environment.PROD` to `env = Environment.DEMO` in `websocket_stream.py`.
