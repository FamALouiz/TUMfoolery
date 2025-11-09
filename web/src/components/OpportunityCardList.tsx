'use client';

import Image from 'next/image';
import { Opportunity } from '@/lib/types';
import { useState } from 'react';
import { CheckCircle2, XCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTeamLogo } from '@/lib/team-logos';
import SparklineChart from './SparklineChart';

interface OpportunityCardListProps {
  opportunity: Opportunity;
}

export default function OpportunityCardList({ opportunity }: OpportunityCardListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isPositiveEV = opportunity.expectedValue > 0;

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatEV = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(1)}%`;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl border border-white/10 mb-3 overflow-hidden transition-all duration-300 hover:border-white/30"
      >
        {/* Main Row */}
        <div
          className="flex items-center justify-between py-8 px-6 cursor-pointer hover:border-white/40 transition-all duration-300"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Team A Badge and Name */}
          <div className="flex items-center gap-6 flex-1 min-w-0">
            <div className="w-28 h-28 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative">
              <Image
                src={getTeamLogo(opportunity.teamA.name)}
                alt={opportunity.teamA.name}
                width={112}
                height={112}
                className="object-contain w-full h-full p-2"
              />
            </div>
            <span className="text-white font-semibold text-xl truncate">{opportunity.teamA.name}</span>
          </div>

          {/* Center - Market and EV */}
          <div className="flex flex-col items-center gap-3 mx-8 flex-shrink-0">
            <div className="text-sm text-gray-400 uppercase tracking-wider font-medium">{opportunity.market}</div>
            <div className="flex items-center gap-4">
              <span
                className={`text-2xl font-extrabold ${
                  isPositiveEV ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatEV(opportunity.expectedValue)}
              </span>
              <span
                className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                  isPositiveEV
                    ? 'bg-green-500/20 text-green-300 border border-green-400/50'
                    : 'bg-red-500/20 text-red-300 border border-red-400/50'
                }`}
              >
                {isPositiveEV ? 'BUY' : 'AVOID'}
              </span>
            </div>
          </div>

          {/* Team B Badge and Name */}
          <div className="flex items-center gap-6 flex-1 min-w-0 justify-end">
            <span className="text-white font-semibold text-xl truncate text-right">{opportunity.teamB.name}</span>
            <div className="w-28 h-28 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative">
              <Image
                src={getTeamLogo(opportunity.teamB.name)}
                alt={opportunity.teamB.name}
                width={112}
                height={112}
                className="object-contain w-full h-full p-2"
              />
            </div>
          </div>

          {/* Expand/Collapse Icon */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="ml-6 text-gray-400 flex-shrink-0"
          >
            <ChevronDown className="w-6 h-6" />
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
              <div className="p-4 space-y-4 bg-gray-900/30">
                {/* Odds Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Market Odds</p>
                    <p className="text-xl font-bold text-gray-200">{formatPercentage(opportunity.marketOdds)}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-white/20">
                    <p className="text-xs text-gray-300 mb-1 uppercase tracking-wider">Model Odds</p>
                    <p className="text-xl font-bold text-white">
                      {formatPercentage(opportunity.modelOdds)}
                    </p>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-2">
                  <div className="relative h-3 bg-gray-800/50 rounded-full overflow-hidden border border-gray-700/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${opportunity.modelOdds * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/60 to-white/40 rounded-full"
                    />
                  </div>
                  <div className="relative h-3 bg-gray-800/50 rounded-full overflow-hidden border border-gray-700/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${opportunity.marketOdds * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-gray-600 to-gray-500 rounded-full"
                    />
                  </div>
                </div>

                {/* Sparkline */}
                <div className="h-20 bg-gray-900/30 rounded-lg p-2 border border-white/10">
                  <SparklineChart data={opportunity.priceHistory} id={opportunity.id} />
                </div>

                {/* Action Button */}
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(true);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white rounded-xl border border-white/20 transition-all font-semibold"
                >
                  View Full Analysis
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Analysis Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="glass-strong rounded-2xl border border-white/20 max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto shadow-2xl shadow-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Analysis</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden relative">
                    <Image
                      src={getTeamLogo(opportunity.teamA.name)}
                      alt={opportunity.teamA.name}
                      width={40}
                      height={40}
                      className="object-contain w-full h-full p-1"
                    />
                  </div>
                  <span className="text-white font-semibold">{opportunity.teamA.name}</span>
                  <span className="text-gray-500">vs</span>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden relative">
                    <Image
                      src={getTeamLogo(opportunity.teamB.name)}
                      alt={opportunity.teamB.name}
                      width={40}
                      height={40}
                      className="object-contain w-full h-full p-1"
                    />
                  </div>
                  <span className="text-white font-semibold">{opportunity.teamB.name}</span>
                </div>
                <p className="text-gray-400">{opportunity.market}</p>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Positive Signals
                  </h4>
                  <ul className="space-y-2">
                    {opportunity.analysis.positiveSignals.map((signal, index) => (
                      <li key={index} className="text-gray-300 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        <span>{signal}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    Negative Signals
                  </h4>
                  <ul className="space-y-2">
                    {opportunity.analysis.negativeSignals.map((signal, index) => (
                      <li key={index} className="text-gray-300 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <span>{signal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

