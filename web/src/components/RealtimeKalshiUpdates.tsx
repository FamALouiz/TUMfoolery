'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { getTeamLogo } from '@/lib/team-logos';
import { Wifi, WifiOff, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MarketUpdate {
  type: 'market_update' | 'status' | 'error' | 'raw';
  timestamp: number;
  data?: {
    ticker: string;
    market_id: string;
    date: string;
    date_formatted: string;
    team1: string;
    team1_full: string;
    team2: string;
    team2_full: string;
    prop: string;
    prop_full: string;
    bet_description: string;
    pricing: {
      current_price: number | null;
      yes_bid: number | null;
      yes_ask: number | null;
      implied_probability: number | null;
    };
    trading_stats: {
      volume: number;
      open_interest: number;
    };
    market_details?: any;
  };
  message?: string;
}

interface MarketUpdateWithId extends MarketUpdate {
  id: string;
  previousPrice?: number | null;
}

export default function RealtimeKalshiUpdates() {
  const [updates, setUpdates] = useState<MarketUpdateWithId[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const priceHistoryRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Create EventSource connection
    const eventSource = new EventSource('/api/kalshi/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      setErrorMessage(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: MarketUpdate = JSON.parse(event.data);
        
        if (data.type === 'market_update' && data.data) {
          // Get previous price for this ticker
          const ticker = data.data.ticker;
          const previousPrice = priceHistoryRef.current.get(ticker);
          const currentPrice = data.data.pricing.current_price;
          
          // Update price history
          if (currentPrice !== null) {
            priceHistoryRef.current.set(ticker, currentPrice);
          }
          
          // Create update with ID and previous price
          const updateWithId: MarketUpdateWithId = {
            ...data,
            id: `${ticker}-${data.timestamp}`,
            previousPrice: previousPrice || null
          };
          
          // Add to updates (keep last 50 updates)
          setUpdates((prev) => {
            const newUpdates = [updateWithId, ...prev].slice(0, 50);
            return newUpdates;
          });
        } else if (data.type === 'status') {
          if (data.message?.includes('opened')) {
            setConnectionStatus('connected');
          } else if (data.message?.includes('closed')) {
            setConnectionStatus('disconnected');
          }
        } else if (data.type === 'error') {
          setConnectionStatus('error');
          setErrorMessage(data.message || 'An error occurred');
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setConnectionStatus('disconnected');
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return `$${price.toFixed(4)}`;
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    // If value is already a percentage (0-100), use it directly
    // If value is a decimal (0-1), convert to percentage
    const percentage = value > 1 ? value : value * 100;
    return `${percentage.toFixed(1)}%`;
  };

  const getPriceChangeIndicator = (current: number | null, previous: number | null) => {
    if (current === null || previous === null || current === previous) {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
    if (current > previous) {
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    }
    return <TrendingDown className="w-4 h-4 text-red-400" />;
  };

  const getPriceChangeColor = (current: number | null, previous: number | null) => {
    if (current === null || previous === null || current === previous) {
      return 'text-white';
    }
    if (current > previous) {
      return 'text-green-400';
    }
    return 'text-red-400';
  };

  // Group updates by ticker (show latest for each)
  const latestByTicker = new Map<string, MarketUpdateWithId>();
  updates.forEach((update) => {
    if (update.data) {
      const ticker = update.data.ticker;
      if (!latestByTicker.has(ticker) || update.timestamp > latestByTicker.get(ticker)!.timestamp) {
        latestByTicker.set(ticker, update);
      }
    }
  });

  const uniqueUpdates = Array.from(latestByTicker.values()).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
  );

  return (
    <div className="w-full space-y-4">
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-white/20 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {connectionStatus === 'connected' ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
          <div>
            <p className="text-sm font-semibold text-white">
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'error' ? 'Error' : 'Disconnected'}
            </p>
            <p className="text-xs text-gray-400">
              {connectionStatus === 'connected' 
                ? `Receiving real-time updates (${uniqueUpdates.length} active markets)`
                : 'Waiting for connection...'}
            </p>
          </div>
        </div>
        {errorMessage && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Updates List */}
      <div className="space-y-3 max-h-[800px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {uniqueUpdates.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl border border-white/20 bg-black/40 backdrop-blur-xl"
            >
              <div className="text-gray-400 mb-2">
                {connectionStatus === 'connecting' ? 'Connecting to Kalshi...' : 'No updates yet'}
              </div>
              <div className="text-xs text-gray-500 text-center max-w-md">
                {connectionStatus === 'connecting' 
                  ? 'Establishing WebSocket connection...'
                  : 'Waiting for EPL game market updates from Kalshi'}
              </div>
            </motion.div>
          ) : (
            uniqueUpdates.map((update) => {
              if (!update.data) return null;
              
              const { data } = update;
              const team1Name = data.team1_full || data.team1 || 'Team 1';
              const team2Name = data.team2_full || data.team2 || 'Team 2';
              const team1Logo = getTeamLogo(team1Name);
              const team2Logo = getTeamLogo(team2Name);
              const currentPrice = data.pricing.current_price;
              const previousPrice = update.previousPrice;
              const probability = data.pricing.implied_probability;

              return (
                <motion.div
                  key={update.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  whileHover={{ y: -2, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="bg-white/8 backdrop-blur-md rounded-2xl border border-white/30 overflow-hidden transition-all duration-300 hover:border-white/50 hover:bg-white/12"
                  style={{
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden relative bg-transparent">
                          <Image
                            src={team1Logo}
                            alt={team1Name}
                            width={48}
                            height={48}
                            className="object-contain w-full h-full p-1"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-semibold text-sm">
                            {team1Name} vs {team2Name}
                          </span>
                          {data.date_formatted && (
                            <span className="text-xs text-gray-400">{data.date_formatted}</span>
                          )}
                        </div>
                      </div>
                      {team2Name && (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden relative bg-transparent">
                          <Image
                            src={team2Logo}
                            alt={team2Name}
                            width={48}
                            height={48}
                            className="object-contain w-full h-full p-1"
                          />
                        </div>
                      )}
                    </div>

                    {/* Bet Description */}
                    {data.bet_description && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Bet</p>
                        <p className="text-white font-medium">{data.bet_description}</p>
                      </div>
                    )}

                    {/* Pricing Section */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/40">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-400">Current Price</p>
                          {getPriceChangeIndicator(currentPrice, previousPrice)}
                        </div>
                        <p className={`text-xl font-bold ${getPriceChangeColor(currentPrice, previousPrice)}`}>
                          {formatPrice(currentPrice)}
                        </p>
                        {probability !== null && (
                          <p className="text-xs text-gray-500 mt-1">
                            {formatPercentage(probability)} probability
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
                        <p className="text-xs text-gray-400 mb-1">Bid / Ask</p>
                        <div className="flex gap-2">
                          <span className="text-green-400 font-semibold">
                            {formatPrice(data.pricing.yes_bid)}
                          </span>
                          <span className="text-gray-500">/</span>
                          <span className="text-red-400 font-semibold">
                            {formatPrice(data.pricing.yes_ask)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Trading Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      {data.trading_stats.volume > 0 && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
                          <p className="text-xs text-gray-400 mb-1">Volume</p>
                          <p className="text-white font-semibold">
                            ${data.trading_stats.volume.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {data.trading_stats.open_interest > 0 && (
                        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
                          <p className="text-xs text-gray-400 mb-1">Open Interest</p>
                          <p className="text-white font-semibold">
                            ${data.trading_stats.open_interest.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Ticker Info */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-gray-500 text-center">Ticker: {data.ticker}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

