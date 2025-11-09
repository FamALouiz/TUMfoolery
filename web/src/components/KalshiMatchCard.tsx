'use client';

import Image from 'next/image';
import { useState } from 'react';
import { KalshiMarket } from '@/lib/kalshi-types';
import { getTeamLogo } from '@/lib/team-logos';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KalshiMatchCardProps {
  markets: KalshiMarket[];
  isExpanded: boolean;
  onToggle: () => void;
}

export default function KalshiMatchCard({ markets, isExpanded, onToggle }: KalshiMatchCardProps) {
  const [team1LogoError, setTeam1LogoError] = useState(false);
  const [team2LogoError, setTeam2LogoError] = useState(false);
  
  const formatPrice = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatPriceCents = (value: number) => {
    return `${Math.round(value * 100)}¢`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (markets.length === 0) return null;

  // Use first market for match info (all markets in group have same teams/date)
  const firstMarket = markets[0];
  const tickerInfo = firstMarket.ticker_info;
  
  // Better fallback logic for team names
  // Check all markets in the group to find the best team name information
  const findBestTeamName = (teamIndex: 0 | 1): string => {
    // First, try to find a market with proper team names
    for (const market of markets) {
      const info = market.ticker_info;
      const teamFull = teamIndex === 0 ? info.team1_full : info.team2_full;
      const teamCode = teamIndex === 0 ? info.team1 : info.team2;
      
      if (teamFull && teamFull !== teamCode && teamFull.length > 2) {
        return teamFull;
      }
    }
    
    // Try to extract from market titles
    const teamPatterns = [
      'Brighton', 'Crystal Palace', 'Aston Villa', 'Manchester City', 'Manchester United',
      'Tottenham', 'Arsenal', 'Liverpool', 'Chelsea', 'Newcastle', 'West Ham',
      'Bournemouth', 'Wolves', 'Everton', 'Fulham', 'Leicester', 'Leeds',
      'Southampton', 'Brentford', 'Nottingham Forest', 'Burnley', 'Sheffield United', 'Luton'
    ];
    
    for (const market of markets) {
      if (market.title) {
        const vsPatterns = [' vs ', ' VS ', ' v ', ' V ', ' - ', ' – '];
        for (const pattern of vsPatterns) {
          if (market.title.includes(pattern)) {
            const parts = market.title.split(pattern);
            if (parts.length >= 2) {
              const teamPart = parts[teamIndex].trim();
              for (const team of teamPatterns) {
                if (teamPart.includes(team) || team.includes(teamPart)) {
                  return team;
                }
              }
            }
          }
        }
        
        // Direct match in title
        for (const team of teamPatterns) {
          if (market.title.includes(team)) {
            return team;
          }
        }
      }
    }
    
    // Fallback to team code from first market
    const teamCode = teamIndex === 0 ? tickerInfo.team1 : tickerInfo.team2;
    return teamCode && teamCode.length === 3 ? teamCode : (teamIndex === 0 ? 'Team 1' : 'Team 2');
  };
  
  const team1Name = findBestTeamName(0);
  const team2Name = findBestTeamName(1);
  
  const team1Logo = team1LogoError ? '/Icons/PL.png' : getTeamLogo(team1Name);
  const team2Logo = team2LogoError ? '/Icons/PL.png' : getTeamLogo(team2Name);

  // Helper function to format team name - no truncation, allow full display
  const formatTeamName = (name: string) => {
    return name;
  };

  // Find markets for each betting option
  // The prop is the last part of the ticker (e.g., AVL, BOU, TIE)
  const team1Code = tickerInfo.team1 || '';
  const team2Code = tickerInfo.team2 || '';
  
  const team1WinMarket = markets.find(m => {
    const prop = m.ticker_info.prop || '';
    return prop === team1Code || 
           m.ticker_info.prop_full?.includes(team1Name + " Wins") ||
           m.ticker_info.bet_description?.includes(team1Name + " Wins");
  });
  
  const tieMarket = markets.find(m => {
    const prop = m.ticker_info.prop || '';
    return prop === "TIE" || 
           prop === "DRAW" ||
           m.ticker_info.prop_full === "Tie/Draw" ||
           m.ticker_info.bet_description?.includes("Tie/Draw");
  });
  
  const team2WinMarket = markets.find(m => {
    const prop = m.ticker_info.prop || '';
    return prop === team2Code || 
           m.ticker_info.prop_full?.includes(team2Name + " Wins") ||
           m.ticker_info.bet_description?.includes(team2Name + " Wins");
  });

  // Calculate average probability for display (or use team1 win if available)
  const displayProbability = team1WinMarket ? team1WinMarket.yes_price : (markets[0]?.yes_price || 0);

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
        {/* Team A Logo and Name - Logo on the left */}
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
            {tickerInfo.date_formatted && (
              <span className="text-xs text-gray-400">{tickerInfo.date_formatted}</span>
            )}
          </div>
        </div>

        {/* Center - VS and Match Info */}
        <div className="flex flex-col items-center justify-center gap-0.5 flex-1 mx-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold leading-none">KALSHI</div>
          <div className="text-xs text-gray-500 leading-none">VS</div>
          <div className="text-xs text-gray-400 text-center leading-none whitespace-nowrap">
            {markets.length} market{markets.length !== 1 ? 's' : ''}
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

      {/* Expanded Details - Show all betting options */}
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
                <p className="text-white font-semibold">{team1Name} vs {team2Name}</p>
                {tickerInfo.date_formatted && (
                  <p className="text-xs text-gray-400 mt-1">{tickerInfo.date_formatted}</p>
                )}
              </div>

              {/* Betting Options */}
              <div className="space-y-3">
                {/* Team 1 Win */}
                {team1WinMarket && (
                  <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/40">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{team1Name}</p>
                      </div>
                      <p className="text-lg font-bold text-green-400">{formatPercentage(team1WinMarket.yes_price)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 bg-gray-700/30 hover:bg-gray-700/40 border border-gray-600/50 rounded-lg px-4 py-2.5 transition-colors">
                        <p className="text-xs text-gray-300 mb-0.5">Yes</p>
                        <p className="text-base font-bold text-gray-200">{formatPriceCents(team1WinMarket.yes_price)}</p>
                      </button>
                      <button className="flex-1 bg-gray-700/30 hover:bg-gray-700/40 border border-gray-600/50 rounded-lg px-4 py-2.5 transition-colors">
                        <p className="text-xs text-gray-300 mb-0.5">No</p>
                        <p className="text-base font-bold text-gray-200">{formatPriceCents(team1WinMarket.no_price)}</p>
                      </button>
                    </div>
                    {team1WinMarket.volume > 0 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">Vol: ${team1WinMarket.volume.toLocaleString()}</p>
                    )}
                  </div>
                )}

                {/* Tie/Draw */}
                {tieMarket && (
                  <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/40">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">Tie</p>
                      </div>
                      <p className="text-lg font-bold text-yellow-400">{formatPercentage(tieMarket.yes_price)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 bg-gray-700/30 hover:bg-gray-700/40 border border-gray-600/50 rounded-lg px-4 py-2.5 transition-colors">
                        <p className="text-xs text-gray-300 mb-0.5">Yes</p>
                        <p className="text-base font-bold text-gray-200">{formatPriceCents(tieMarket.yes_price)}</p>
                      </button>
                      <button className="flex-1 bg-gray-700/30 hover:bg-gray-700/40 border border-gray-600/50 rounded-lg px-4 py-2.5 transition-colors">
                        <p className="text-xs text-gray-300 mb-0.5">No</p>
                        <p className="text-base font-bold text-gray-200">{formatPriceCents(tieMarket.no_price)}</p>
                      </button>
                    </div>
                    {tieMarket.volume > 0 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">Vol: ${tieMarket.volume.toLocaleString()}</p>
                    )}
                  </div>
                )}

                {/* Team 2 Win */}
                {team2WinMarket && (
                  <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/40">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{team2Name}</p>
                      </div>
                      <p className="text-lg font-bold text-blue-400">{formatPercentage(team2WinMarket.yes_price)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 bg-gray-700/30 hover:bg-gray-700/40 border border-gray-600/50 rounded-lg px-4 py-2.5 transition-colors">
                        <p className="text-xs text-gray-300 mb-0.5">Yes</p>
                        <p className="text-base font-bold text-gray-200">{formatPriceCents(team2WinMarket.yes_price)}</p>
                      </button>
                      <button className="flex-1 bg-gray-700/30 hover:bg-gray-700/40 border border-gray-600/50 rounded-lg px-4 py-2.5 transition-colors">
                        <p className="text-xs text-gray-300 mb-0.5">No</p>
                        <p className="text-base font-bold text-gray-200">{formatPriceCents(team2WinMarket.no_price)}</p>
                      </button>
                    </div>
                    {team2WinMarket.volume > 0 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">Vol: ${team2WinMarket.volume.toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Market Links */}
              <div className="grid grid-cols-1 gap-2 pt-2 border-t border-white/10">
                {markets.map((market, index) => (
                  market.market_url && (
                    <a
                      key={`${market.market_id || market.ticker}-${index}-${market.ticker_info.prop || ''}`}
                      href={market.market_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors text-xs"
                    >
                      <span>{market.ticker_info.bet_description || market.ticker_info.prop_full}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )
                ))}
              </div>

              {/* Ticker Info */}
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-gray-500 text-center">
                  {markets.length} market{markets.length !== 1 ? 's' : ''} • Status: {firstMarket.status}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

