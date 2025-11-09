'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ManifoldMarket } from '@/lib/manifold-types';
import { getTeamLogo } from '@/lib/team-logos';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ManifoldMatchCardProps {
  market: ManifoldMarket;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function ManifoldMatchCard({ market, isExpanded, onToggle }: ManifoldMatchCardProps) {
  const [team1LogoError, setTeam1LogoError] = useState(false);
  const [team2LogoError, setTeam2LogoError] = useState(false);
  
  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatVolume = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K MANA`;
    }
    return `${value.toFixed(0)} MANA`;
  };

  const team1Name = market.team1;
  const team2Name = market.team2;
  
  const team1Logo = team1LogoError ? '/Icons/PL.png' : getTeamLogo(team1Name);
  const team2Logo = team2LogoError ? '/Icons/PL.png' : getTeamLogo(team2Name);

  // Helper function to format team name - no truncation, allow full display
  const formatTeamName = (name: string) => {
    return name;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="bg-white/8 backdrop-blur-md rounded-2xl border border-white/30 mb-4 overflow-hidden transition-all duration-300 hover:border-white/50 hover:bg-white/12"
      style={{
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Main Row - Match Header */}
      <div
        className="flex items-center justify-between py-6 px-5 cursor-pointer hover:bg-white/5 transition-all duration-300 min-h-[80px]"
        onClick={onToggle}
      >
        {/* Team A Logo and Name */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden relative bg-transparent flex-shrink-0"
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
              onError={() => {
                // Fallback to PL logo if image fails to load
                if (!team1LogoError) {
                  setTeam1LogoError(true);
                }
              }}
              unoptimized
            />
          </div>
          <div className="flex flex-col" style={{ minWidth: '140px', maxWidth: '180px' }}>
            <span className="text-white font-semibold text-sm drop-shadow-lg block break-words">
              {formatTeamName(team1Name)}
            </span>
            <span className="text-xs text-gray-400">Week {market.matchweek}</span>
          </div>
        </div>

        {/* Center - MANIFOLD and Probability */}
        <div className="flex flex-col items-center justify-center gap-0.5 flex-1 mx-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold leading-none">MANIFOLD</div>
          <div className="text-xs text-gray-500 leading-none">VS</div>
          <div className="text-xl font-extrabold text-white">
            {formatPercentage(market.probability)}
          </div>
        </div>

        {/* Team B Name and Logo */}
        {team2Name && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex flex-col" style={{ minWidth: '140px', maxWidth: '180px' }}>
              <span className="text-white font-semibold text-sm drop-shadow-lg block break-words text-right">
                {formatTeamName(team2Name)}
              </span>
            </div>
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
                onError={() => {
                  // Fallback to PL logo if image fails to load
                  if (!team2LogoError) {
                    setTeam2LogoError(true);
                  }
                }}
                unoptimized
              />
            </div>
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
              {/* Match Info */}
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Match</p>
                <p className="text-white font-semibold">{market.match_text}</p>
                <p className="text-xs text-gray-400 mt-1">Matchweek {market.matchweek}</p>
              </div>

              {/* Probability and Volume */}
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className="bg-green-500/10 rounded-lg p-3 border border-green-500/40"
                  style={{
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <p className="text-xs text-gray-400 mb-1">Probability</p>
                  <p className="text-lg font-bold text-green-400">{formatPercentage(market.probability)}</p>
                </div>
                {market.volume > 0 && (
                  <div 
                    className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50"
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="text-xs text-gray-400 mb-1">Volume</p>
                    <p className="text-lg font-bold text-white">{formatVolume(market.volume)}</p>
                  </div>
                )}
              </div>

              {/* Market Question */}
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Market Question</p>
                <p className="text-sm text-white">{market.question}</p>
              </div>

              {/* Market Link */}
              {market.url && (
                <a
                  href={market.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                >
                  <span className="text-sm font-medium">View on Manifold</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* Market Status */}
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-gray-500 text-center">
                  Status: {market.is_resolved ? 'Resolved' : 'Open'} • Week {market.matchweek}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

