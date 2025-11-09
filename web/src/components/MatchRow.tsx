'use client';

import Image from 'next/image';
import { useState } from 'react';
import { MatchPrediction } from '@/lib/types';
import { getTeamLogo } from '@/lib/team-logos';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SparklineChart from './SparklineChart';

interface MatchRowProps {
  match: MatchPrediction;
  isExpanded: boolean;
  onToggle: () => void;
  columnType: 'tumfoolery' | 'kalshi' | 'manifold';
}

export default function MatchRow({ match, isExpanded, onToggle, columnType }: MatchRowProps) {
  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatPrice = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const getColumnData = () => {
    switch (columnType) {
      case 'tumfoolery':
        return {
          title: 'TUMfoolery',
          prediction: match.tumfoolery.prediction,
          confidence: match.tumfoolery.confidence,
          recommendation: match.tumfoolery.recommendation,
          expectedValue: match.tumfoolery.expectedValue,
          showEV: true,
        };
      case 'kalshi':
        return {
          title: 'Kalshi',
          prediction: match.kalshi.prediction,
          yesPrice: match.kalshi.yesPrice,
          noPrice: match.kalshi.noPrice,
          volume: match.kalshi.volume,
          showEV: false,
        };
      case 'manifold':
        return {
          title: 'Manifold',
          prediction: match.manifold.prediction,
          yesPrice: match.manifold.yesPrice,
          noPrice: match.manifold.noPrice,
          volume: match.manifold.volume,
          showEV: false,
        };
    }
  };

  const columnData = getColumnData();
  const isPositive = columnData.expectedValue && columnData.expectedValue > 0;
  
  // Determine winning team based on market and prediction
  const getWinningTeam = () => {
    // Check if market mentions teamA
    if (match.market.toLowerCase().includes(match.teamA.name.toLowerCase())) {
      return columnData.prediction > 0.5 ? match.teamA.name : match.teamB.name;
    }
    // Check if market mentions teamB
    if (match.market.toLowerCase().includes(match.teamB.name.toLowerCase())) {
      return columnData.prediction > 0.5 ? match.teamB.name : match.teamA.name;
    }
    // Default: higher prediction wins
    return columnData.prediction > 0.5 ? match.teamA.name : match.teamB.name;
  };
  
  const winningTeam = getWinningTeam();

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
        {/* Team A Logo and Abbreviated Name */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden relative bg-transparent"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))',
            }}
          >
            <Image
              src={getTeamLogo(match.teamA.name)}
              alt={match.teamA.name}
              width={56}
              height={56}
              className="object-contain w-full h-full p-1.5"
            />
          </div>
          <span className="text-white font-semibold text-sm drop-shadow-lg">{match.teamA.name.substring(0, 4)}...</span>
        </div>

        {/* Center - Prediction Source, Percentage, and Winning Team */}
        <div className="flex flex-col items-center gap-1 flex-1 mx-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{columnData.title}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white">{formatPercentage(columnData.prediction)}</span>
            <span className="text-sm font-semibold text-white">{winningTeam}</span>
          </div>
          {/* Additional Info Below */}
          {columnData.showEV && columnData.expectedValue !== undefined && (
            <div className={`text-xs font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{formatPercentage(columnData.expectedValue)}
            </div>
          )}
          {!columnData.showEV && (
            <div className="flex gap-2 text-xs">
              <span className="text-green-400">YES: {formatPrice(columnData.yesPrice!)}</span>
              <span className="text-red-400">NO: {formatPrice(columnData.noPrice!)}</span>
            </div>
          )}
        </div>

        {/* Team B Logo */}
        <div 
          className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden relative bg-transparent flex-shrink-0"
          style={{
            filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))',
          }}
        >
          <Image
            src={getTeamLogo(match.teamB.name)}
            alt={match.teamB.name}
            width={56}
            height={56}
            className="object-contain w-full h-full p-1.5"
          />
        </div>

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
                <p className="text-white font-semibold">{match.market}</p>
              </div>

              {/* Column-specific details */}
              {columnType === 'tumfoolery' && (
                <div className="grid grid-cols-2 gap-3">
                  <div 
                    className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50"
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="text-xs text-gray-400 mb-1">Confidence</p>
                    <p className="text-lg font-bold text-white">{formatPercentage(columnData.confidence!)}</p>
                  </div>
                  <div 
                    className={`rounded-lg p-3 border ${
                      columnData.recommendation === 'BUY' ? 'bg-green-500/10 border-green-500/40' : 
                      columnData.recommendation === 'SELL' ? 'bg-red-500/10 border-red-500/40' : 
                      'bg-gray-800/60 border-gray-700/50'
                    }`}
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="text-xs text-gray-400 mb-1">Recommendation</p>
                    <p className={`text-lg font-bold ${
                      columnData.recommendation === 'BUY' ? 'text-green-400' : 
                      columnData.recommendation === 'SELL' ? 'text-red-400' : 
                      'text-gray-400'
                    }`}>
                      {columnData.recommendation}
                    </p>
                  </div>
                </div>
              )}

              {(columnType === 'kalshi' || columnType === 'manifold') && (
                <div className="grid grid-cols-2 gap-3">
                  <div 
                    className="bg-green-500/10 rounded-lg p-3 border border-green-500/40"
                    style={{
                      boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="text-xs text-gray-400 mb-1">YES Price</p>
                    <p className="text-lg font-bold text-green-400">{formatPrice(columnData.yesPrice!)}</p>
                  </div>
                  <div 
                    className="bg-red-500/10 rounded-lg p-3 border border-red-500/40"
                    style={{
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="text-xs text-gray-400 mb-1">NO Price</p>
                    <p className="text-lg font-bold text-red-400">{formatPrice(columnData.noPrice!)}</p>
                  </div>
                  {columnData.volume && (
                    <div 
                      className="col-span-2 bg-gray-800/60 rounded-lg p-3 border border-gray-700/50"
                      style={{
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <p className="text-xs text-gray-400 mb-1">Volume</p>
                      <p className="text-lg font-bold text-white">${columnData.volume.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sparkline */}
              <div 
                className="h-16 bg-gray-900/40 rounded-lg p-2 border border-white/10"
                style={{
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
                }}
              >
                <SparklineChart data={match.priceHistory} id={`${match.id}-${columnType}`} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

