// Kalshi API types

export interface KalshiTickerInfo {
  team1?: string;
  team2?: string;
  team1_full?: string;
  team2_full?: string;
  prop?: string;
  prop_full?: string;
  bet_description?: string;
  date?: string;
  date_formatted?: string;
  matchweek?: number;
}

export interface KalshiMarket {
  market_id: string;
  ticker: string;
  title: string;
  yes_price: number;
  no_price: number;
  volume: number;
  ticker_info: KalshiTickerInfo;
  open_time?: string;
  close_time?: string;
  expected_expiration_time?: string;
  status?: string;
  can_close_early?: boolean;
  expiration_value?: string;
  result?: string;
}

export interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  count?: number;
  error?: string;
  debug?: {
    sample_tickers?: string[];
    stdout?: string;
    stderr?: string;
    message?: string;
    stack?: string;
  };
}
