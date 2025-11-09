'use client';

import Image from 'next/image';
import { Opportunity } from '@/lib/types';
import { useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTeamLogo } from '@/lib/team-logos';
import SparklineChart from './SparklineChart';

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export default function OpportunityCard({ opportunity }: OpportunityCardProps) {
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
        whileHover={{ y: -6, scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25, mass: 0.8 }}
        className="glass rounded-xl border border-white/10 p-6 relative overflow-visible group"
      >
        {/* Enhanced shadow on hover */}
        <motion.div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10"
          style={{
            boxShadow: '0 20px 60px -15px rgba(255, 255, 255, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          }}
        />
        
        {/* Top-right corner glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
        >
          {/* Corner gradient glow */}
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/40 via-white/20 to-transparent rounded-tl-3xl rounded-tr-xl blur-md"></div>
          {/* Top border highlight */}
          <div className="absolute top-0 right-0 w-16 h-0.5 bg-gradient-to-r from-white/60 via-white/40 to-transparent rounded-full"></div>
          {/* Right border highlight */}
          <div className="absolute top-0 right-0 w-0.5 h-16 bg-gradient-to-b from-white/60 via-white/40 to-transparent rounded-full"></div>
        </motion.div>

        {/* Bottom-left corner glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute bottom-0 left-0 w-24 h-24 pointer-events-none"
        >
          {/* Corner gradient glow */}
          <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-tr from-white/40 via-white/20 to-transparent rounded-br-3xl rounded-bl-xl blur-md"></div>
          {/* Bottom border highlight */}
          <div className="absolute bottom-0 left-0 w-16 h-0.5 bg-gradient-to-l from-white/60 via-white/40 to-transparent rounded-full"></div>
          {/* Left border highlight */}
          <div className="absolute bottom-0 left-0 w-0.5 h-16 bg-gradient-to-t from-white/60 via-white/40 to-transparent rounded-full"></div>
        </motion.div>
        {/* Top Section - Teams */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="flex items-center gap-3"
            >
              <div className="w-20 h-20 rounded-lg flex items-center justify-center overflow-hidden relative">
                <Image
                  src={getTeamLogo(opportunity.teamA.name)}
                  alt={opportunity.teamA.name}
                  width={80}
                  height={80}
                  className="object-contain w-full h-full p-2"
                />
              </div>
              <span className="text-white font-semibold text-lg">{opportunity.teamA.name}</span>
            </motion.div>
            <span className="text-gray-500 font-medium">vs</span>
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="flex items-center gap-3"
            >
              <div className="w-20 h-20 rounded-lg flex items-center justify-center overflow-hidden relative">
                <Image
                  src={getTeamLogo(opportunity.teamB.name)}
                  alt={opportunity.teamB.name}
                  width={80}
                  height={80}
                  className="object-contain w-full h-full p-2"
                />
              </div>
              <span className="text-white font-semibold text-lg">{opportunity.teamB.name}</span>
            </motion.div>
          </div>
        </div>

        {/* Market Info */}
        <div className="mb-4 relative z-10">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Market</p>
          <p className="text-white font-semibold text-lg">{opportunity.market}</p>
        </div>

        {/* Middle Section - Odds Comparison */}
        <div className="mb-6 relative z-10">
          <div className="flex justify-between items-center mb-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Market Odds</p>
              <p className="text-xl font-bold text-gray-200">{formatPercentage(opportunity.marketOdds)}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-right"
            >
              <p className="text-xs text-gray-300 mb-1 uppercase tracking-wider">Our Model&apos;s Odds</p>
              <p className="text-xl font-bold text-white">
                {formatPercentage(opportunity.modelOdds)}
              </p>
            </motion.div>
          </div>

          {/* Discrepancy Bar */}
          <div className="space-y-3">
            <div className="relative h-4 bg-gray-800/50 rounded-full overflow-hidden border border-gray-700/50">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${opportunity.modelOdds * 100}%` }}
                transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/60 to-white/40 rounded-full shadow-lg shadow-white/20"
              />
            </div>
            <div className="relative h-4 bg-gray-800/50 rounded-full overflow-hidden border border-gray-700/50">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${opportunity.marketOdds * 100}%` }}
                transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-gray-600 to-gray-500 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Bottom Section - EV and Action */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <p className="text-xs text-gray-400 mb-2">Expected Value</p>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <p
                className={`text-3xl font-extrabold bg-gradient-to-r ${
                  isPositiveEV
                    ? 'from-green-400 to-emerald-300'
                    : 'from-red-400 to-rose-300'
                } bg-clip-text text-transparent drop-shadow-lg`}
              >
                {formatEV(opportunity.expectedValue)}
              </p>
            </motion.div>
          </div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-lg ${
              isPositiveEV
                ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/20 text-green-300 border border-green-400/50 shadow-green-500/20'
                : 'bg-gradient-to-r from-red-500/30 to-rose-500/20 text-red-300 border border-red-400/50 shadow-red-500/20'
            }`}
          >
            {isPositiveEV ? 'BUY YES' : 'SELL / AVOID'}
          </motion.div>
        </div>

        {/* Sparkline Chart */}
        <div className="mb-4 h-20 relative z-10 bg-gray-900/30 rounded-lg p-2 border border-white/10">
          <SparklineChart data={opportunity.priceHistory} id={opportunity.id} />
        </div>

        {/* View Analysis Button */}
        <motion.button
          onClick={() => setIsModalOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 text-white rounded-xl border border-white/20 transition-all font-semibold relative overflow-hidden group/btn"
        >
          <span className="relative z-10">View Analysis</span>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 0.6 }}
          />
        </motion.button>
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
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
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
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
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

