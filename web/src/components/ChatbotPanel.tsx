"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

interface ChatbotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  marketData: {
    team1: string;
    team2: string;
    marketDescription: string;
    tumfooleryProb: number;
    kalshiProb?: number;
    manifoldProb?: number;
  };
}

export default function ChatbotPanel({
  isOpen,
  onClose,
  marketData,
}: ChatbotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `I'm analyzing the market: "${marketData.marketDescription}" for ${marketData.team1} vs ${marketData.team2}.\n\nI've gathered data from multiple sources including X (Twitter), Instagram, recent news articles, and historical performance data. What would you like to know?`,
      sources: ["Twitter", "Instagram", "News", "Historical Data"],
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const mockResponses = [
    {
      content: `Based on social media sentiment analysis from X and Instagram:\n\n• ${
        marketData.team1
      } has 67% positive sentiment in recent posts\n• ${
        marketData.team2
      } has 54% positive sentiment\n• Trending hashtags suggest higher engagement for ${
        marketData.team1
      }\n\nRecent injury reports from team news indicate ${
        marketData.team2
      } may be missing key players, which could explain the ${Math.abs(
        (marketData.tumfooleryProb - (marketData.kalshiProb || 0)) * 100
      ).toFixed(1)}% discrepancy between TUMfoolery and Kalshi predictions.`,
      sources: ["Twitter", "Instagram", "Team News"],
    },
    {
      content: `Historical matchup analysis:\n\n• Last 5 meetings: ${
        marketData.team1
      } won 3, ${
        marketData.team2
      } won 2\n• Home advantage: Currently playing at ${
        Math.random() > 0.5 ? marketData.team1 : marketData.team2
      }'s stadium\n• Weather conditions: Favorable for attacking play\n\nMarket efficiency indicators suggest the current spread between sources represents a genuine arbitrage opportunity rather than information asymmetry.`,
      sources: ["Historical Data", "Weather API", "Stadium Info"],
    },
    {
      content: `Recent news coverage highlights:\n\n• ${
        marketData.team1
      }'s recent form: 4 wins in last 6 games\n• ${
        marketData.team2
      }'s recent form: 2 wins in last 6 games\n• Key player performance metrics favor ${
        marketData.team1
      }\n\nThe ${(marketData.tumfooleryProb * 100).toFixed(
        1
      )}% TUMfoolery prediction aligns with advanced analytics models, while market prices may be influenced by public sentiment rather than fundamentals.`,
      sources: ["Sports News", "Analytics", "Team Stats"],
    },
  ];

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const randomResponse =
        mockResponses[Math.floor(Math.random() * mockResponses.length)];
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: randomResponse.content,
          sources: randomResponse.sources,
        },
      ]);
      setIsTyping(false);
    }, 1500);
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full md:w-[480px] bg-black/90 backdrop-blur-2xl border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      AI Market Analyst
                    </h2>
                    <p className="text-xs text-gray-400">
                      Powered by TUMfoolery
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Market Context */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-gray-400 mb-1">Analyzing</p>
                <p className="text-sm text-white font-medium">
                  {marketData.team1} vs {marketData.team2}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {marketData.marketDescription}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] ${
                      message.role === "user" ? "order-2" : "order-1"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-linear-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                          <Image
                            src="/logo.svg"
                            alt="AI"
                            width={16}
                            height={16}
                            className="object-contain"
                          />
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                          TUMfoolery AI
                        </span>
                      </div>
                    )}
                    <div
                      className={`p-4 rounded-2xl ${
                        message.role === "user"
                          ? "bg-purple-500/20 border border-purple-500/30"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      <p className="text-sm text-white whitespace-pre-line">
                        {message.content}
                      </p>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-xs text-gray-400 mb-2">Sources:</p>
                          <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-gray-300"
                              >
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-lg bg-linear-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                        <Image
                          src="/logo.svg"
                          alt="AI"
                          width={16}
                          height={16}
                          className="object-contain"
                        />
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        TUMfoolery AI
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex gap-1">
                        <div
                          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask about this market..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="px-4 py-3 rounded-xl bg-linear-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-white hover:from-purple-500/30 hover:to-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                AI responses are for informational purposes only
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
