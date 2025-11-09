"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { AlertCircle, TrendingUp, TrendingDown } from "lucide-react";

interface MarketSource {
  name: string;
  logo: string;
  probability: number;
  volume?: number | string;
}

interface CompareMarketCardProps {
  team1: string;
  team2: string;
  team1Logo: string;
  team2Logo: string;
  marketDescription: string;
  tumfooleryProb: number;
  kalshiProb?: number;
  manifoldProb?: number;
  kalshiVolume?: number;
  manifoldVolume?: number;
  onSummarize: () => void;
}

export default function CompareMarketCard({
  team1,
  team2,
  team1Logo,
  team2Logo,
  marketDescription,
  tumfooleryProb,
  kalshiProb,
  manifoldProb,
  kalshiVolume,
  manifoldVolume,
  onSummarize,
}: CompareMarketCardProps) {
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  const sources: MarketSource[] = [
    { name: "TUMfoolery", logo: "/logo.svg", probability: tumfooleryProb },
  ];

  if (kalshiProb !== undefined) {
    sources.push({
      name: "Kalshi",
      logo: "/kalshi.png",
      probability: kalshiProb,
      volume: kalshiVolume
        ? `$${(kalshiVolume / 1000).toFixed(0)}K`
        : undefined,
    });
  }

  if (manifoldProb !== undefined) {
    sources.push({
      name: "Manifold",
      logo: "/manifold.png",
      probability: manifoldProb,
      volume: manifoldVolume
        ? `${
            manifoldVolume >= 1000
              ? (manifoldVolume / 1000).toFixed(0) + "K"
              : manifoldVolume.toFixed(0)
          } MANA`
        : undefined,
    });
  }

  // Calculate discrepancies
  const calculateDiscrepancy = (prob1: number, prob2: number) => {
    return Math.abs(prob1 - prob2);
  };

  const maxDiscrepancy = Math.max(
    kalshiProb !== undefined
      ? calculateDiscrepancy(tumfooleryProb, kalshiProb)
      : 0,
    manifoldProb !== undefined
      ? calculateDiscrepancy(tumfooleryProb, manifoldProb)
      : 0,
    kalshiProb !== undefined && manifoldProb !== undefined
      ? calculateDiscrepancy(kalshiProb, manifoldProb)
      : 0
  );

  const hasSignificantDiscrepancy = maxDiscrepancy > 0.1; // 10% difference

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="glass rounded-2xl border border-white/10 p-6 relative overflow-visible group"
    >
      {/* Match Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden relative">
              <Image
                src={team1Logo}
                alt={team1}
                width={48}
                height={48}
                className="object-contain w-full h-full p-1"
              />
            </div>
            <span className="text-white font-semibold">{team1}</span>
          </div>
          <span className="text-gray-500 font-medium text-sm">vs</span>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden relative">
              <Image
                src={team2Logo}
                alt={team2}
                width={48}
                height={48}
                className="object-contain w-full h-full p-1"
              />
            </div>
            <span className="text-white font-semibold">{team2}</span>
          </div>
        </div>

        {/* Discrepancy Badge */}
        {hasSignificantDiscrepancy && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400">
              {formatPercentage(maxDiscrepancy)} variance
            </span>
          </div>
        )}
      </div>

      {/* Market Description */}
      <div className="mb-4">
        <p className="text-sm text-gray-300">{marketDescription}</p>
      </div>

      {/* Source Comparisons */}
      <div className="space-y-3 mb-6">
        {sources.map((source, index) => {
          const isHighest =
            source.probability ===
            Math.max(...sources.map((s) => s.probability));
          const isLowest =
            source.probability ===
            Math.min(...sources.map((s) => s.probability));

          return (
            <div
              key={source.name}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                  <Image
                    src={source.logo}
                    alt={source.name}
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {source.name}
                  </p>
                  {source.volume && (
                    <p className="text-xs text-gray-500">
                      Vol: {source.volume}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {sources.length > 1 && (
                  <div className="flex items-center gap-1">
                    {isHighest && !isLowest && (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    )}
                    {isLowest && !isHighest && (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                )}
                <span
                  className={`text-lg font-bold ${
                    isHighest && !isLowest
                      ? "text-green-400"
                      : isLowest && !isHighest
                      ? "text-red-400"
                      : "text-white"
                  }`}
                >
                  {formatPercentage(source.probability)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summarize Button */}
      <button
        onClick={onSummarize}
        className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-white font-medium hover:from-purple-500/30 hover:to-blue-500/30 transition-all duration-200 flex items-center justify-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        Summarize with AI
      </button>
    </motion.div>
  );
}
