// Manifold API types

export interface ManifoldMarket {
  market_id: string;
  question: string;
  url: string;
  probability: number;
  volume: number;
  team1: string;
  team2: string;
  match_text: string;
  matchweek: number;
  created_time?: string;
  close_time?: string;
  resolution_time?: string;
  isResolved?: boolean;
  resolution?: string;
  pool?: {
    YES?: number;
    NO?: number;
  };
}

export interface ManifoldMarketsResponse {
  markets: ManifoldMarket[];
  count?: number;
  error?: string;
  debug?: {
    stdout?: string;
    stderr?: string;
    message?: string;
    stack?: string;
  };
}
