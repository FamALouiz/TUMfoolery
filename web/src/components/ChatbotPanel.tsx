"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Sparkles,
  Trash2,
  Settings,
  Loader2,
  Globe,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSession } from "next-auth/react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp?: number;
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

interface ScrapingStatus {
  source: string;
  status: "pending" | "scraping" | "complete" | "error";
  icon: string;
}

const AVAILABLE_SOURCES = [
  { id: "Twitter", label: "X (Twitter)", icon: "𝕏" },
  { id: "Instagram", label: "Instagram", icon: "📷" },
  { id: "Reddit", label: "Reddit", icon: "🔴" },
  { id: "News", label: "News Articles", icon: "📰" },
  { id: "Historical Data", label: "Historical Data", icon: "📊" },
  { id: "Weather", label: "Weather", icon: "🌤️" },
  { id: "Team News", label: "Team News", icon: "⚽" },
  { id: "Statistics", label: "Statistics", icon: "📈" },
];

export default function ChatbotPanel({
  isOpen,
  onClose,
  marketData,
}: ChatbotPanelProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState<ScrapingStatus[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [enabledSources, setEnabledSources] = useState<string[]>(
    AVAILABLE_SOURCES.map((s) => s.id)
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Generate unique market key based on market
  const marketKey =
    `${marketData.team1}-${marketData.team2}-${marketData.marketDescription}`
      .replace(/\s+/g, "-")
      .toLowerCase();

  // Load chat history from database
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!isOpen || !session?.user || hasInitialized) return;

      try {
        const response = await fetch(
          `/api/chat?marketKey=${encodeURIComponent(marketKey)}`
        );

        if (response.ok) {
          const data = await response.json();

          if (data.chatHistory) {
            setMessages(
              data.chatHistory.messages.map((msg: any) => ({
                role: msg.role,
                content: msg.content,
                sources: msg.sources,
                timestamp: new Date(msg.timestamp).getTime(),
              }))
            );
            setEnabledSources(
              data.chatHistory.enabledSources ||
                AVAILABLE_SOURCES.map((s) => s.id)
            );
            setHasInitialized(true);
          } else {
            // Initialize with first message and auto-analyze
            initializeChat();
          }
        } else {
          initializeChat();
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
        initializeChat();
      }
    };

    loadChatHistory();
  }, [isOpen, session, marketKey, hasInitialized]);

  // Save messages to database whenever they change
  useEffect(() => {
    const saveChatHistory = async () => {
      if (!session?.user || messages.length === 0 || !hasInitialized) return;

      try {
        await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            marketKey,
            team1: marketData.team1,
            team2: marketData.team2,
            marketDescription: marketData.marketDescription,
            messages,
            enabledSources,
          }),
        });
      } catch (error) {
        console.error("Error saving chat history:", error);
      }
    };

    // Debounce saving to avoid too many requests
    const timeoutId = setTimeout(saveChatHistory, 1000);
    return () => clearTimeout(timeoutId);
  }, [
    messages,
    enabledSources,
    session,
    marketKey,
    marketData,
    hasInitialized,
  ]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, isScraping]);

  const initializeChat = async () => {
    setHasInitialized(true);
    const initialMessage: Message = {
      role: "assistant",
      content: `Initializing analysis for **${marketData.team1} vs ${
        marketData.team2
      }**...\n\nI'll now scrape data from the following sources:\n${enabledSources
        .map((s) => `• ${s}`)
        .join("\n")}\n\nThis will take a moment...`,
      timestamp: Date.now(),
    };
    setMessages([initialMessage]);

    // Auto-analyze on first open
    await performAnalysis(
      "Please provide a comprehensive analysis of this market. Is this a worthwhile bet?"
    );
  };

  const performAnalysis = async (userQuestion: string) => {
    setIsScraping(true);

    // Initialize scraping status
    const initialStatus: ScrapingStatus[] = enabledSources.map((source) => ({
      source,
      status: "pending" as const,
      icon: AVAILABLE_SOURCES.find((s) => s.id === source)?.icon || "🔍",
    }));
    setScrapingStatus(initialStatus);

    // Simulate scraping animation
    for (let i = 0; i < enabledSources.length; i++) {
      await new Promise((resolve) =>
        setTimeout(resolve, 300 + Math.random() * 400)
      );
      setScrapingStatus((prev) =>
        prev.map((item, index) =>
          index === i ? { ...item, status: "scraping" } : item
        )
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 400 + Math.random() * 600)
      );
      setScrapingStatus((prev) =>
        prev.map((item, index) =>
          index === i ? { ...item, status: "complete" } : item
        )
      );
    }

    setIsScraping(false);
    setIsTyping(true);

    try {
      // Call Gemini API
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          marketData,
          userMessage: userQuestion,
          conversationHistory: messages.filter(
            (m) =>
              m.role !== "assistant" ||
              !m.content.includes("Initializing analysis")
          ),
          enabledSources,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get analysis");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.content,
        sources: data.sources || enabledSources,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error getting analysis:", error);
      const errorMessage: Message = {
        role: "assistant",
        content:
          "I apologize, but I encountered an error while analyzing the market. Please try again or check your API configuration.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setScrapingStatus([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = inputValue;
    setInputValue("");

    await performAnalysis(question);
  };

  const handleDeleteChat = async () => {
    if (
      confirm(
        "Are you sure you want to delete this chat history? This cannot be undone."
      )
    ) {
      try {
        await fetch(`/api/chat?marketKey=${encodeURIComponent(marketKey)}`, {
          method: "DELETE",
        });

        setMessages([]);
        setHasInitialized(false);
        initializeChat();
      } catch (error) {
        console.error("Error deleting chat history:", error);
      }
    }
  };

  const toggleSource = (sourceId: string) => {
    setEnabledSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
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
                      Powered by Google Gemini
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center"
                    title="Data Sources"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={handleDeleteChat}
                    className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
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

              {/* Settings Panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <p className="text-xs text-gray-400 font-medium">
                          Data Sources ({enabledSources.length} enabled)
                        </p>
                      </div>
                      <div className="space-y-2">
                        {AVAILABLE_SOURCES.map((source) => (
                          <button
                            key={source.id}
                            onClick={() => toggleSource(source.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                              enabledSources.includes(source.id)
                                ? "bg-purple-500/20 border border-purple-500/30"
                                : "bg-white/5 border border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{source.icon}</span>
                              <span className="text-xs text-white">
                                {source.label}
                              </span>
                            </div>
                            <div
                              className={`w-4 h-4 rounded border transition-colors ${
                                enabledSources.includes(source.id)
                                  ? "bg-purple-500 border-purple-500"
                                  : "border-gray-500"
                              }`}
                            >
                              {enabledSources.includes(source.id) && (
                                <svg
                                  className="w-full h-full text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Select sources to include in analysis
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`w-full ${
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
                          ? "bg-purple-500/20 border border-purple-500/30 ml-auto max-w-[85%]"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="text-sm text-white prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              // Customize heading styles
                              h1: ({ node, ...props }) => (
                                <h1
                                  className="text-lg font-bold text-white mb-2 mt-4"
                                  {...props}
                                />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2
                                  className="text-base font-bold text-white mb-2 mt-3"
                                  {...props}
                                />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3
                                  className="text-sm font-semibold text-white mb-1 mt-2"
                                  {...props}
                                />
                              ),
                              // Customize paragraph styles
                              p: ({ node, ...props }) => (
                                <p
                                  className="text-sm text-gray-200 mb-2"
                                  {...props}
                                />
                              ),
                              // Customize list styles
                              ul: ({ node, ...props }) => (
                                <ul
                                  className="list-disc list-inside mb-2 space-y-1"
                                  {...props}
                                />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol
                                  className="list-decimal list-inside mb-2 space-y-1"
                                  {...props}
                                />
                              ),
                              li: ({ node, ...props }) => (
                                <li
                                  className="text-sm text-gray-200 ml-2"
                                  {...props}
                                />
                              ),
                              // Customize link styles
                              a: ({ node, ...props }) => (
                                <a
                                  className="text-purple-400 hover:text-purple-300 underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  {...props}
                                />
                              ),
                              // Customize code styles
                              code: ({ node, inline, ...props }: any) =>
                                inline ? (
                                  <code
                                    className="bg-white/10 px-1 py-0.5 rounded text-xs text-purple-300"
                                    {...props}
                                  />
                                ) : (
                                  <code
                                    className="block bg-white/10 p-2 rounded text-xs overflow-x-auto"
                                    {...props}
                                  />
                                ),
                              // Customize blockquote styles
                              blockquote: ({ node, ...props }) => (
                                <blockquote
                                  className="border-l-4 border-purple-500/50 pl-4 italic text-gray-300 my-2"
                                  {...props}
                                />
                              ),
                              // Customize strong/bold styles
                              strong: ({ node, ...props }) => (
                                <strong
                                  className="font-bold text-white"
                                  {...props}
                                />
                              ),
                              // Customize emphasis/italic styles
                              em: ({ node, ...props }) => (
                                <em
                                  className="italic text-gray-300"
                                  {...props}
                                />
                              ),
                              // Customize table styles
                              table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-2">
                                  <table
                                    className="min-w-full border border-white/10"
                                    {...props}
                                  />
                                </div>
                              ),
                              thead: ({ node, ...props }) => (
                                <thead className="bg-white/5" {...props} />
                              ),
                              tbody: ({ node, ...props }) => (
                                <tbody {...props} />
                              ),
                              tr: ({ node, ...props }) => (
                                <tr
                                  className="border-b border-white/10"
                                  {...props}
                                />
                              ),
                              th: ({ node, ...props }) => (
                                <th
                                  className="px-3 py-2 text-left text-xs font-semibold text-white"
                                  {...props}
                                />
                              ),
                              td: ({ node, ...props }) => (
                                <td
                                  className="px-3 py-2 text-xs text-gray-200"
                                  {...props}
                                />
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm text-white whitespace-pre-line">
                          {message.content}
                        </p>
                      )}
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

              {/* Scraping Animation */}
              {isScraping && (
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-lg bg-linear-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        Scraping Data...
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="space-y-2">
                        {scrapingStatus.map((item, index) => (
                          <motion.div
                            key={item.source}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center gap-3"
                          >
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-xs text-gray-300 flex-1">
                              {item.source}
                            </span>
                            {item.status === "pending" && (
                              <div className="w-2 h-2 rounded-full bg-gray-500" />
                            )}
                            {item.status === "scraping" && (
                              <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                            )}
                            {item.status === "complete" && (
                              <svg
                                className="w-3 h-3 text-green-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Typing Animation */}
              {isTyping && !isScraping && (
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

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-6 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" &&
                    !isTyping &&
                    !isScraping &&
                    handleSendMessage()
                  }
                  placeholder="Ask about this market..."
                  disabled={isTyping || isScraping}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping || isScraping}
                  className="px-4 py-3 rounded-xl bg-linear-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-white hover:from-purple-500/30 hover:to-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isTyping || isScraping ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
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
