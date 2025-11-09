'use client';

import { KalshiMarket } from '@/lib/kalshi-types';
import { getTeamLogo } from '@/lib/team-logos';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface KalshiMarketRowProps {
  market: KalshiMarket;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function KalshiMarketRow({ market, isExpanded, onToggle }: KalshiMarketRowProps) {
  const formatPrice = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatPriceCents = (value: number) => {
    return `${Math.round(value * 100)}¢`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const tickerInfo = market.ticker_info;
  const team1Name = tickerInfo.team1_full || tickerInfo.team1 || 'Team 1';
  const team2Name = tickerInfo.team2_full || tickerInfo.team2 || 'Team 2';
  
  // Get team logos - try to match team names
  const team1Logo = getTeamLogo(team1Name);
  const team2Logo = getTeamLogo(team2Name);

  // Calculate probability from yes_price (price is already in dollars, e.g., 0.42 = 42%)
  const probability = market.yes_price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="bg-white/8 backdrop-blur-md rounded-2xl border border-white/30 mb-4 overflow-hidden transition-all duration-300 hover:border-white/50 hover:bg-white/12 min-h-[120px]"
      style={{
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Main Row */}
      <div
        className="flex items-center justify-between py-6 px-5 cursor-pointer hover:bg-white/5 transition-all duration-300"
        onClick={onToggle}
      >
        {/* Team A Logo and Name */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden relative bg-transparent"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))',
            }}
          >
            <Image
              src={team1Logo}
              alt={team1Name}
              width={56}
              height={56}
              className="object-contain w-full h-full p-1.5"
            />
          </div>
          <span className="text-white font-semibold text-sm drop-shadow-lg">
            {team1Name.length > 8 ? team1Name.substring(0, 8) + '...' : team1Name}
          </span>
        </div>

        {/* Center - Kalshi, Percentage, and Bet Description */}
        <div className="flex flex-col items-center gap-1 flex-1 mx-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Kalshi</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white">{formatPercentage(probability)}</span>
          </div>
          <div className="text-xs text-gray-400 text-center max-w-[200px] truncate">
            {tickerInfo.bet_description || tickerInfo.prop_full || market.title}
          </div>
          <div className="flex gap-2 mt-1">
            <button className="bg-gray-700/30 hover:bg-gray-700/40 border border-gray-600/50 rounded-lg px-3 py-1.5 transition-colors">
              <p className="text-[10px] text-gray-300 mb-0.5">Yes</p>
              <p className="text-sm font-bold text-gray-200">{formatPriceCents(market.yes_price)}</p>
            </button>
            <button className="bg-gray-700/30 hover:bg-gray-700/40 border border-gray-600/50 rounded-lg px-3 py-1.5 transition-colors">
              <p className="text-[10px] text-gray-300 mb-0.5">No</p>
              <p className="text-sm font-bold text-gray-200">{formatPriceCents(market.no_price)}</p>
            </button>
          </div>
        </div>

        {/* Team B Logo */}
        {team2Name && (
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden relative bg-transparent flex-shrink-0"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))',
            }}
          >
            <Image
              src={team2Logo}
              alt={team2Name}
              width={56}
              height={56}
              className="object-contain w-full h-full p-1.5"
            />
          </div>
        )}

        {/* Expand Icon */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="ml-4 text-gray-400 flex-shrink-0"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-4 space-y-4 bg-black/20">
              {/* Market Info */}
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Market</p>
                <p className="text-white font-semibold">{market.title || tickerInfo.bet_description}</p>
                {market.subtitle && (
                  <p className="text-xs text-gray-400 mt-1">{market.subtitle}</p>
                )}
              </div>

              {/* Date Info */}
              {tickerInfo.date_formatted && (
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Match Date</p>
                  <p className="text-white font-semibold">{tickerInfo.date_formatted}</p>
                </div>
              )}

              {/* Pricing Details */}
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className="bg-green-500/10 rounded-lg p-3 border border-green-500/40"
                  style={{
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <p className="text-xs text-gray-400 mb-1">YES Price</p>
                  <p className="text-lg font-bold text-green-400">{formatPrice(market.yes_price)}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatPercentage(probability)} probability</p>
                </div>
                <div 
                  className="bg-red-500/10 rounded-lg p-3 border border-red-500/40"
                  style={{
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <p className="text-xs text-gray-400 mb-1">NO Price</p>
                  <p className="text-lg font-bold text-red-400">{formatPrice(market.no_price)}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatPercentage(1 - probability)} probability</p>
                </div>
              </div>

              {/* Volume and Open Interest */}
              <div className="grid grid-cols-2 gap-3">
                {market.volume > 0 && (
                  <div 
                    className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50"
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="text-xs text-gray-400 mb-1">Volume</p>
                    <p className="text-lg font-bold text-white">${market.volume.toLocaleString()}</p>
                  </div>
                )}
                {market.open_interest > 0 && (
                  <div 
                    className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50"
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="text-xs text-gray-400 mb-1">Open Interest</p>
                    <p className="text-lg font-bold text-white">${market.open_interest.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Market Link */}
              {market.market_url && (
                <a
                  href={market.market_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                >
                  <span className="text-sm font-medium">View on Kalshi</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* Ticker Info */}
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-gray-500 text-center">Ticker: {market.ticker}</p>
                <p className="text-xs text-gray-500 text-center mt-1">Status: {market.status}</p>
                {market.market_id && (
                  <p className="text-xs text-gray-600 text-center mt-1">ID: {market.market_id.substring(0, 20)}...</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

