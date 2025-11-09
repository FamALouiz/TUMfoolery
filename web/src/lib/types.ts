// Core types for the TUMfoolery application

export interface Team {
  name: string;
  logo?: string;
}

export interface TumfooleryPrediction {
  prediction: number;
  confidence: number;
  recommendation: string;
  expectedValue: number;
}

export interface KalshiPrediction {
  prediction: number;
  yesPrice: number;
  noPrice: number;
  volume: number;
}

export interface ManifoldPrediction {
  prediction: number;
  yesPrice: number;
  noPrice: number;
  volume: number;
}

export interface MatchPrediction {
  id: string;
  teamA: Team;
  teamB: Team;
  market: string;
  tumfoolery: TumfooleryPrediction;
  kalshi: KalshiPrediction;
  manifold: ManifoldPrediction;
  date?: string;
  timeSeriesData?: number[];
}

export interface Opportunity {
  id: string;
  teamA: Team;
  teamB: Team;
  market: string;
  marketOdds: number;
  modelOdds: number;
  expectedValue: number;
  date?: string;
  timeSeriesData?: number[];
}
