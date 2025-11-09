"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, TrendingUp, Loader2 } from "lucide-react";

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  team1: string;
  team2: string;
  marketDescription: string;
  platform: string;
  odds: number;
  onConfirm: (amount: number) => Promise<void>;
}

export default function BetModal({
  isOpen,
  onClose,
  team1,
  team2,
  marketDescription,
  platform,
  odds,
  onConfirm,
}: BetModalProps) {
  const [betAmount, setBetAmount] = useState("100");
  const [selectedOutcome, setSelectedOutcome] = useState(team1);
  const [isPlacing, setIsPlacing] = useState(false);

  const potentialProfit = parseFloat(betAmount) * odds - parseFloat(betAmount);

  const handlePlaceBet = async () => {
    setIsPlacing(true);
    try {
      await onConfirm(parseFloat(betAmount));
      onClose();
      setBetAmount("100");
    } catch (error) {
      console.error("Error placing bet:", error);
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 max-w-md w-full relative pointer-events-auto max-h-[85vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              {/* Header */}
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Place Bet
                </h2>
                <p className="text-gray-400 text-sm">
                  {team1} vs {team2}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {marketDescription}
                </p>
              </div>

              {/* Platform Badge */}
              <div className="mb-4 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 inline-block">
                <span className="text-sm text-blue-400 font-medium">
                  Platform: {platform}
                </span>
              </div>

              {/* Outcome Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Outcome
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedOutcome(team1)}
                    className={`p-3 rounded-xl border transition-all ${
                      selectedOutcome === team1
                        ? "bg-purple-500/20 border-purple-500/50 text-white"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {team1}
                  </button>
                  <button
                    onClick={() => setSelectedOutcome(team2)}
                    className={`p-3 rounded-xl border transition-all ${
                      selectedOutcome === team2
                        ? "bg-purple-500/20 border-purple-500/50 text-white"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {team2}
                  </button>
                </div>
              </div>

              {/* Bet Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bet Amount ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min="1"
                    step="1"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[50, 100, 250, 500].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setBetAmount(amount.toString())}
                      className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bet Summary */}
              <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Odds</span>
                  <span className="text-white font-medium">
                    {odds.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Potential Profit</span>
                  <span className="text-green-400 font-medium flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />$
                    {potentialProfit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                  <span className="text-gray-400">Total Payout</span>
                  <span className="text-white font-bold">
                    ${(parseFloat(betAmount) * odds).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Warning */}
              <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-xs text-yellow-400">
                  ⚠️ <strong>Mock Bet:</strong> This is a demonstration. No
                  actual money will be transferred.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isPlacing}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlaceBet}
                  disabled={
                    isPlacing || !betAmount || parseFloat(betAmount) <= 0
                  }
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-white font-medium hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPlacing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Placing...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5" />
                      Place Bet
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
