"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import BettingHistory from "@/components/BettingHistory";

export default function HistoryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [bets, setBets] = useState<any[]>([]);
  const [isLoadingBets, setIsLoadingBets] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push("/auth/login");
      return;
    }
    fetchBettingHistory();
  }, [session, router]);

  const fetchBettingHistory = async () => {
    setIsLoadingBets(true);
    try {
      const response = await fetch("/api/bets/history");
      if (response.ok) {
        const data = await response.json();
        setBets(data.bets || []);
      }
    } catch (error) {
      console.error("Error fetching betting history:", error);
    } finally {
      setIsLoadingBets(false);
    }
  };

  const handleAnalyzeBet = async (betId: string) => {
    try {
      const response = await fetch(`/api/bets/${betId}/analyze`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        // Update the bet in the list with the AI analysis
        setBets((prevBets) =>
          prevBets.map((bet) =>
            bet.id === betId ? { ...bet, aiAnalysis: data.analysis } : bet
          )
        );
      }
    } catch (error) {
      console.error("Error analyzing bet:", error);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Betting History
          </h1>
          <p className="text-gray-400">
            Track all your bets and analyze your performance
          </p>
        </motion.div>

        {/* Betting History Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-8"
        >
          {isLoadingBets ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : (
            <BettingHistory bets={bets} onAnalyzeBet={handleAnalyzeBet} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
