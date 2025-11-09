"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";

interface Bet {
  id: string;
  team1: string;
  team2: string;
  marketDescription: string;
  platform: string;
  betAmount: number;
  odds: number;
  predictedOutcome: string;
  actualOutcome: string | null;
  profitLoss: number | null;
  status: string;
  walletAddress: string;
  aiSummary: string | null;
  createdAt: string;
  settledAt: string | null;
}

interface BettingHistoryProps {
  bets: Bet[];
  onAnalyzeBet: (betId: string) => void;
}

export default function BettingHistory({
  bets,
  onAnalyzeBet,
}: BettingHistoryProps) {
  const [expandedBet, setExpandedBet] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "won":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      case "lost":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "pending":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "won":
        return <CheckCircle className="w-4 h-4" />;
      case "lost":
        return <XCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (bets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-purple-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No bets yet</h3>
        <p className="text-gray-400">
          Start betting on matches to see your history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bets.map((bet) => (
        <motion.div
          key={bet.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-200"
        >
          {/* Bet Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                {bet.team1} vs {bet.team2}
              </h3>
              <p className="text-sm text-gray-400">{bet.marketDescription}</p>
            </div>
            <div
              className={`px-3 py-1.5 rounded-full border flex items-center gap-2 ${getStatusColor(
                bet.status
              )}`}
            >
              {getStatusIcon(bet.status)}
              <span className="text-xs font-medium capitalize">
                {bet.status}
              </span>
            </div>
          </div>

          {/* Bet Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Platform</p>
              <p className="text-sm font-medium text-white">{bet.platform}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Bet Amount</p>
              <p className="text-sm font-medium text-white">
                ${bet.betAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Odds</p>
              <p className="text-sm font-medium text-white">
                {bet.odds.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Profit/Loss</p>
              <p
                className={`text-sm font-medium flex items-center gap-1 ${
                  bet.profitLoss === null
                    ? "text-gray-400"
                    : bet.profitLoss >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {bet.profitLoss !== null && (
                  <>
                    {bet.profitLoss >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    ${Math.abs(bet.profitLoss).toFixed(2)}
                  </>
                )}
                {bet.profitLoss === null && "Pending"}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Wallet: {formatWalletAddress(bet.walletAddress)}</span>
              <span>•</span>
              <span>{formatDate(bet.createdAt)}</span>
            </div>

            {/* AI Analysis Button */}
            <button
              onClick={() => {
                if (expandedBet === bet.id) {
                  setExpandedBet(null);
                } else {
                  if (!bet.aiSummary) {
                    onAnalyzeBet(bet.id);
                  }
                  setExpandedBet(bet.id);
                }
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-400 text-xs font-medium hover:from-purple-500/30 hover:to-blue-500/30 transition-all duration-200 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {expandedBet === bet.id ? "Hide" : "AI"} Analysis
            </button>
          </div>

          {/* AI Summary */}
          <AnimatePresence>
            {expandedBet === bet.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-white/10"
              >
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  {bet.aiSummary ? (
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                      {bet.aiSummary}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-purple-400">
                      <div className="animate-spin w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full" />
                      <span className="text-sm">Generating AI analysis...</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}
