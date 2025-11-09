"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import MatchRow from "@/components/MatchRow";
import KalshiMarketRow from "@/components/KalshiMarketRow";
import KalshiMatchCard from "@/components/KalshiMatchCard";
import AnimatedBackground from "@/components/AnimatedBackground";
import CompareMarketCard from "@/components/CompareMarketCard";
import ChatbotPanel from "@/components/ChatbotPanel";
import BetModal from "@/components/BetModal";
import WalletConnectModal from "@/components/WalletConnectModal";
import { mockMatches } from "@/lib/mock-data";
import { getTeamLogo } from "@/lib/team-logos";
import { KalshiMarket, KalshiMarketsResponse } from "@/lib/kalshi-types";
import { ManifoldMarket, ManifoldMarketsResponse } from "@/lib/manifold-types";
import ManifoldMatchCard from "@/components/ManifoldMatchCard";
import ProfilePage from "@/app/profile/page";
import HistoryPage from "./history/page";

export default function Home() {
  const [activePage, setActivePage] = useState("dashboard");
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(
    new Set()
  );
  const [kalshiMarkets, setKalshiMarkets] = useState<KalshiMarket[]>([]);
  const [kalshiLoading, setKalshiLoading] = useState(false);
  const [kalshiError, setKalshiError] = useState<string | null>(null);
  const [expandedKalshiMarkets, setExpandedKalshiMarkets] = useState<
    Set<string>
  >(new Set());
  const [kalshiRefreshKey, setKalshiRefreshKey] = useState(0);
  const [kalshiStreaming, setKalshiStreaming] = useState(false);
  const [kalshiScrapingDate, setKalshiScrapingDate] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrapingStartedRef = useRef<boolean>(false);

  // Manifold state
  const [manifoldMarkets, setManifoldMarkets] = useState<ManifoldMarket[]>([]);
  const [manifoldLoading, setManifoldLoading] = useState(false);
  const [manifoldError, setManifoldError] = useState<string | null>(null);
  const [expandedManifoldMarkets, setExpandedManifoldMarkets] = useState<
    Set<string>
  >(new Set());
  const [manifoldRefreshKey, setManifoldRefreshKey] = useState(0);

  // Compare page state
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [selectedMarketForChat, setSelectedMarketForChat] = useState<any>(null);
  const [betModalData, setBetModalData] = useState<{
    isOpen: boolean;
    team1: string;
    team2: string;
    marketDescription: string;
    platform: string;
    odds: number;
  } | null>(null);

  // Wallet state
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{
    address: string | null;
    type: string | null;
    connected: boolean;
  }>({ address: null, type: null, connected: false });

  const handleBet = async (
    team1: string,
    team2: string,
    marketDescription: string,
    platform: string,
    odds: number
  ) => {
    setBetModalData({
      isOpen: true,
      team1,
      team2,
      marketDescription,
      platform,
      odds,
    });
  };

  const handleConfirmBet = async (
    amount: number,
    team1: string,
    team2: string,
    marketDescription: string,
    platform: string,
    odds: number
  ) => {
    try {
      const response = await fetch("/api/bets/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1,
          team2,
          marketDescription,
          platform,
          betAmount: amount,
          odds,
          predictedOutcome: team1, // Default to team1 for now
        }),
      });

      if (response.ok) {
        alert("Bet placed successfully!");
        setBetModalData(null);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to place bet");
      }
    } catch (error) {
      console.error("Error placing bet:", error);
      alert("Error placing bet");
    }
  };

  const handleWalletConnect = async (walletType: string, address: string) => {
    try {
      const response = await fetch("/api/wallet/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, walletType }),
      });

      if (response.ok) {
        const data = await response.json();
        setWalletInfo({
          address: data.wallet.address,
          type: data.wallet.type,
          connected: true,
        });
        setIsWalletModalOpen(false);
        alert("Wallet connected successfully!");
      } else {
        alert("Failed to connect wallet");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Error connecting wallet");
    }
  };

  // Fetch wallet info on mount
  useEffect(() => {
    const fetchWalletInfo = async () => {
      try {
        const response = await fetch("/api/wallet/info");
        if (response.ok) {
          const data = await response.json();
          setWalletInfo(data.wallet);
        }
      } catch (error) {
        console.error("Error fetching wallet info:", error);
      }
    };
    fetchWalletInfo();
  }, []);

  // Load saved markets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kalshiMarkets");
      const savedTimestamp = localStorage.getItem("kalshiMarketsTimestamp");
      if (saved && savedTimestamp) {
        const markets = JSON.parse(saved) as KalshiMarket[];
        const timestamp = parseInt(savedTimestamp, 10);
        const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);

        // Only use saved data if it's less than 5 minutes old
        if (ageInMinutes < 5 && markets.length > 0) {
          setKalshiMarkets(markets);
        }
      }
    } catch (error) {
      console.error("Error loading saved Kalshi markets:", error);
    }

    // Load saved Manifold markets
    try {
      const saved = localStorage.getItem("manifoldMarkets");
      const savedTimestamp = localStorage.getItem("manifoldMarketsTimestamp");
      if (saved && savedTimestamp) {
        const markets = JSON.parse(saved) as ManifoldMarket[];
        const timestamp = parseInt(savedTimestamp, 10);
        const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);

        // Only use saved data if it's less than 10 minutes old (Manifold updates less frequently)
        if (ageInMinutes < 10 && markets.length > 0) {
          setManifoldMarkets(markets);
        }
      }
    } catch (error) {
      console.error("Error loading saved Manifold markets:", error);
    }
  }, []);

  // Fetch a few markets for dashboard if we don't have any
  useEffect(() => {
    if (activePage === "dashboard" && kalshiMarkets.length === 0) {
      // Try to fetch a few markets for dashboard preview
      fetch("/api/kalshi/markets?limit=5")
        .then((res) => res.json())
        .then((data: KalshiMarketsResponse) => {
          if (data.markets && data.markets.length > 0) {
            setKalshiMarkets(data.markets);
          }
        })
        .catch((error) => {
          // Silently fail - dashboard can work without Kalshi data
          console.warn("Could not fetch Kalshi markets for dashboard:", error);
        });
    }

    // Fetch Manifold markets for dashboard if we don't have any
    if (activePage === "dashboard" && manifoldMarkets.length === 0) {
      fetch("/api/manifold/markets?startWeek=11&maxWeeks=20")
        .then((res) => res.json())
        .then((data: ManifoldMarketsResponse) => {
          if (data.markets && data.markets.length > 0) {
            setManifoldMarkets(data.markets);
          }
        })
        .catch((error) => {
          // Silently fail - dashboard can work without Manifold data
          console.warn(
            "Could not fetch Manifold markets for dashboard:",
            error
          );
        });
    }
  }, [activePage, kalshiMarkets.length, manifoldMarkets.length]);

  // Save markets to localStorage whenever they update
  useEffect(() => {
    if (kalshiMarkets.length > 0) {
      try {
        localStorage.setItem("kalshiMarkets", JSON.stringify(kalshiMarkets));
        localStorage.setItem("kalshiMarketsTimestamp", Date.now().toString());
      } catch (error) {
        console.error("Error saving Kalshi markets to localStorage:", error);
      }
    }
  }, [kalshiMarkets]);

  // Save Manifold markets to localStorage
  useEffect(() => {
    if (manifoldMarkets.length > 0) {
      try {
        localStorage.setItem(
          "manifoldMarkets",
          JSON.stringify(manifoldMarkets)
        );
        localStorage.setItem("manifoldMarketsTimestamp", Date.now().toString());
      } catch (error) {
        console.error("Error saving Manifold markets to localStorage:", error);
      }
    }
  }, [manifoldMarkets]);

  const toggleMatch = (matchId: string) => {
    setExpandedMatches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  const toggleKalshiMarket = (marketId: string) => {
    setExpandedKalshiMarkets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(marketId)) {
        newSet.delete(marketId);
      } else {
        newSet.add(marketId);
      }
      return newSet;
    });
  };

  const toggleManifoldMarket = (marketId: string) => {
    setExpandedManifoldMarkets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(marketId)) {
        newSet.delete(marketId);
      } else {
        newSet.add(marketId);
      }
      return newSet;
    });
  };

  // Fetch Manifold markets when manifold page is active
  useEffect(() => {
    if (activePage === "manifold") {
      // Check if we have fresh saved data
      const savedTimestamp = localStorage.getItem("manifoldMarketsTimestamp");
      if (savedTimestamp && manifoldMarkets.length > 0) {
        const timestamp = parseInt(savedTimestamp, 10);
        const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
        // If data is less than 5 minutes old, use it without fetching
        if (ageInMinutes < 5) {
          return;
        }
      }

      // Fetch markets
      setManifoldLoading(true);
      setManifoldError(null);

      fetch("/api/manifold/markets?startWeek=11&maxWeeks=20")
        .then((res) => res.json())
        .then((data: ManifoldMarketsResponse) => {
          if (data.error && data.markets.length === 0) {
            setManifoldError(data.error);
          } else {
            setManifoldMarkets(data.markets || []);
            setManifoldError(null);
          }
          setManifoldLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching Manifold markets:", error);
          setManifoldError(error.message || "Failed to fetch Manifold markets");
          setManifoldLoading(false);
        });
    }
  }, [activePage, manifoldRefreshKey]);

  // Fetch Kalshi markets when kalshi page is active - using fast fetch + streaming approach
  useEffect(() => {
    if (activePage === "kalshi") {
      // Don't clear markets - keep saved data
      // Only start new scraping if we haven't started yet or if explicitly refreshing
      const shouldStartScraping =
        !scrapingStartedRef.current || kalshiRefreshKey > 0;

      // If refreshing, reset the scraping started flag
      if (kalshiRefreshKey > 0) {
        scrapingStartedRef.current = false;
      }

      const seenMarketIds = new Set<string>();
      // Add existing markets to seen set to avoid duplicates
      kalshiMarkets.forEach((m) => {
        const marketId = m.market_id || m.ticker;
        seenMarketIds.add(marketId);
      });

      // Check if we have fresh saved data (less than 2 minutes old)
      const savedTimestamp = localStorage.getItem("kalshiMarketsTimestamp");
      if (savedTimestamp && !shouldStartScraping) {
        const timestamp = parseInt(savedTimestamp, 10);
        const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
        // If data is less than 2 minutes old, we can use it without starting new scrape
        if (ageInMinutes < 2 && kalshiMarkets.length > 0) {
          // Data is fresh, no need to scrape again
          return;
        }
      }

      // Only start new scraping if needed
      if (!shouldStartScraping) {
        // If we already have markets and scraping is done, just return
        // The EventSource might still be running in background
        return;
      }

      // Start new scraping session
      setKalshiLoading(true);
      setKalshiError(null);
      // Don't clear markets - keep what we have from localStorage
      setKalshiStreaming(false);
      setKalshiScrapingDate(false);
      scrapingStartedRef.current = true;

      // Step 1: Fast HTTP fetch for initial markets (first 10 for quick display)
      // Add timeout to prevent hanging
      const fetchController = new AbortController();
      const timeoutId = setTimeout(() => fetchController.abort(), 10000); // 10 second timeout

      // Set scraping status
      setKalshiScrapingDate(true);

      // Safety timeout: always clear loading after 15 seconds
      const safetyTimeout = setTimeout(() => {
        setKalshiLoading(false);
        setKalshiScrapingDate(false);
        // Check if we have markets - if not, show timeout error
        setKalshiMarkets((prevMarkets) => {
          if (prevMarkets.length === 0) {
            setKalshiError(
              "Request timed out. Please try refreshing or check your connection."
            );
          }
          return prevMarkets;
        });
      }, 15000);

      fetch("/api/kalshi/markets?limit=10", { signal: fetchController.signal })
        .then((res) => res.json())
        .then((data: KalshiMarketsResponse) => {
          clearTimeout(timeoutId);
          clearTimeout(safetyTimeout);
          // Add initial markets from HTTP fetch (even if there's an error, use what we got)
          const initialMarkets = data.markets || [];
          if (initialMarkets.length > 0) {
            initialMarkets.forEach((m: KalshiMarket) => {
              const marketId = m.market_id || m.ticker;
              seenMarketIds.add(marketId);
            });
            setKalshiMarkets(initialMarkets);
          }

          // Always stop loading after fetch completes (success or error)
          setKalshiLoading(false);
          setKalshiScrapingDate(false);

          if (data.error && initialMarkets.length === 0) {
            // Only warn if we got no markets
            console.warn(
              "HTTP fetch failed, continuing with streaming only:",
              data.error
            );
            setKalshiError(data.error);
          }

          // Step 2: Start streaming for additional markets
          setKalshiStreaming(true);
          setKalshiScrapingDate(true); // Still scraping via streaming
          const eventSource = new EventSource("/api/kalshi/markets-stream");
          eventSourceRef.current = eventSource;

          eventSource.onopen = () => {
            // Streaming started
          };

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);

              if (
                data.type === "initial_batch" ||
                data.type === "final_batch"
              ) {
                // Add all markets from batch
                const newMarkets = (data.markets || []).filter(
                  (m: KalshiMarket) => {
                    const marketId = m.market_id || m.ticker;
                    if (!seenMarketIds.has(marketId)) {
                      seenMarketIds.add(marketId);
                      return true;
                    }
                    return false;
                  }
                );

                if (newMarkets.length > 0) {
                  setKalshiMarkets((prev) => [...prev, ...newMarkets]);
                }

                // Don't stop streaming on final_batch - continue indefinitely
                // Final batch is just a status update, streaming continues
              } else if (data.type === "market_update") {
                // Add individual market update
                const market = data.market as KalshiMarket;
                const marketId = market.market_id || market.ticker;

                if (!seenMarketIds.has(marketId)) {
                  seenMarketIds.add(marketId);
                  setKalshiMarkets((prev) => [...prev, market]);
                } else {
                  // Update existing market
                  setKalshiMarkets((prev) =>
                    prev.map((m) =>
                      (m.market_id || m.ticker) === marketId ? market : m
                    )
                  );
                }
              } else if (data.type === "status") {
                if (
                  data.message?.includes("Stopping scraper") ||
                  data.message?.includes("inactivity")
                ) {
                  // Scraper stopped due to 2-minute timeout - this is expected
                  setKalshiStreaming(false);
                  setKalshiScrapingDate(false);
                  // Data is already saved to localStorage
                  if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                    eventSourceRef.current = null;
                  }
                } else if (
                  data.message?.includes("closed") &&
                  !data.message?.includes("opened")
                ) {
                  // Only stop if explicitly closed (not just connection opened message)
                  setKalshiStreaming(false);
                  setKalshiScrapingDate(false);
                  if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                    eventSourceRef.current = null;
                  }
                } else if (data.message?.includes("opened")) {
                  setKalshiStreaming(true);
                  setKalshiScrapingDate(true);
                }
                // Don't stop on 'complete' - let it continue streaming
              } else if (data.type === "error") {
                // Don't show streaming errors as main error, just log them
                console.error("Streaming error:", data.message);
                setKalshiStreaming(false);
                setKalshiScrapingDate(false);
                if (eventSourceRef.current) {
                  eventSourceRef.current.close();
                  eventSourceRef.current = null;
                }
              }
            } catch (error) {
              console.error("Error parsing SSE message:", error);
            }
          };

          eventSource.onerror = (error) => {
            // Check if connection is actually closed or just reconnecting
            if (eventSourceRef.current) {
              const readyState = eventSourceRef.current.readyState;

              // EventSource.CLOSED = 2 means connection is closed
              if (readyState === EventSource.CLOSED) {
                // Connection closed - this is normal after timeout or completion
                // Don't log as error, just update state
                setKalshiStreaming(false);
                setKalshiScrapingDate(false);
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              } else if (readyState === EventSource.CONNECTING) {
                // Connection is reconnecting - this is normal, don't log as error
                // Keep streaming state as is, let it reconnect
              } else {
                // EventSource.OPEN = 1 but error occurred - log as warning, not error
                console.warn(
                  "EventSource connection issue (readyState:",
                  readyState,
                  ")"
                );
                // Don't close immediately - let it try to reconnect
              }
            } else {
              // EventSource ref is null - connection was already closed
              setKalshiStreaming(false);
              setKalshiScrapingDate(false);
            }
          };
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          clearTimeout(safetyTimeout);
          console.error("Error fetching initial Kalshi markets:", error);
          // Always stop loading on error
          setKalshiLoading(false);
          setKalshiScrapingDate(false);
          setKalshiError(
            error.message || "Failed to fetch markets. Trying streaming..."
          );

          // If HTTP fetch fails, still try streaming
          setKalshiStreaming(true);
          setKalshiScrapingDate(true); // Still scraping via streaming

          const eventSource = new EventSource("/api/kalshi/markets-stream");
          eventSourceRef.current = eventSource;
          const streamSeenIds = new Set<string>();

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (
                data.type === "market_update" ||
                data.type === "initial_batch" ||
                data.type === "final_batch"
              ) {
                const markets = data.markets || [data.market].filter(Boolean);
                markets.forEach((m: KalshiMarket) => {
                  const marketId = m.market_id || m.ticker;
                  if (!streamSeenIds.has(marketId)) {
                    streamSeenIds.add(marketId);
                    setKalshiMarkets((prev) => [...prev, m]);
                    setKalshiLoading(false);
                    setKalshiError(null); // Clear error once we get markets
                  }
                });

                if (data.type === "final_batch") {
                  setKalshiStreaming(false);
                  setKalshiScrapingDate(false);
                  if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                    eventSourceRef.current = null;
                  }
                }
              }
            } catch (e) {
              console.error("Error parsing stream:", e);
            }
          };

          eventSource.onerror = () => {
            // Check if connection is actually closed or just reconnecting
            if (eventSourceRef.current) {
              const readyState = eventSourceRef.current.readyState;

              // EventSource.CLOSED = 2 means connection is closed
              if (readyState === EventSource.CLOSED) {
                // Connection closed - this is normal after timeout or completion
                setKalshiStreaming(false);
                setKalshiScrapingDate(false);
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              }
              // If CONNECTING, let it try to reconnect
              // If OPEN, don't close immediately
            } else {
              setKalshiStreaming(false);
              setKalshiScrapingDate(false);
            }
          };
        });

      // Cleanup function - don't stop scraping when navigating away
      // Keep EventSource open in background - it will continue until 2-minute timeout
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(safetyTimeout);
        // Don't close EventSource when navigating away - let it continue in background
        // The Python script will stop after 2 minutes of inactivity
        // Data is already saved to localStorage via the useEffect that watches kalshiMarkets
      };
    }
    // When navigating away from Kalshi page, EventSource continues in background
    // Data is saved to localStorage automatically
  }, [activePage, kalshiRefreshKey]);

  const renderColumn = (
    columnType: "tumfoolery" | "kalshi" | "manifold",
    title: string,
    subtitle: string
  ) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="rounded-2xl border border-white/20 p-6 relative overflow-visible group bg-black/50 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Enhanced shadow on hover */}
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10"
          style={{
            boxShadow:
              "0 24px 64px -12px rgba(255, 255, 255, 0.25), 0 8px 24px rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2)",
          }}
        />

        {/* Top-right corner glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
        >
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/40 via-white/20 to-transparent rounded-tl-3xl rounded-tr-xl blur-md"></div>
          <div className="absolute top-0 right-0 w-16 h-0.5 bg-gradient-to-r from-white/60 via-white/40 to-transparent rounded-full"></div>
          <div className="absolute top-0 right-0 w-0.5 h-16 bg-gradient-to-b from-white/60 via-white/40 to-transparent rounded-full"></div>
        </motion.div>

        {/* Bottom-left corner glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute bottom-0 left-0 w-24 h-24 pointer-events-none"
        >
          <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-tr from-white/40 via-white/20 to-transparent rounded-br-3xl rounded-bl-xl blur-md"></div>
          <div className="absolute bottom-0 left-0 w-16 h-0.5 bg-gradient-to-l from-white/60 via-white/40 to-transparent rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-0.5 h-16 bg-gradient-to-t from-white/60 via-white/40 to-transparent rounded-full"></div>
        </motion.div>

        {/* Column Header */}
        <div className="mb-6 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
            {columnType === "kalshi" && (
              <button
                onClick={() => {
                  // Trigger a refresh by incrementing the key to restart the stream
                  setKalshiMarkets([]);
                  setKalshiLoading(true);
                  setKalshiError(null);
                  setKalshiStreaming(false);
                  setKalshiScrapingDate(false);
                  setKalshiRefreshKey((prev) => prev + 1); // This will trigger the useEffect to restart
                }}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <svg
                  className={`w-4 h-4 ${kalshiLoading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {kalshiLoading ? "Loading..." : "Refresh"}
              </button>
            )}
            {columnType === "manifold" && (
              <button
                onClick={() => {
                  setManifoldMarkets([]);
                  setManifoldLoading(true);
                  setManifoldError(null);
                  setManifoldRefreshKey((prev) => prev + 1);
                }}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <svg
                  className={`w-4 h-4 ${manifoldLoading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {manifoldLoading ? "Loading..." : "Refresh"}
              </button>
            )}
          </div>
        </div>

        {/* Fixtures inside the card */}
        <div className="space-y-3 relative z-10">
          {columnType === "kalshi" ? (
            <>
              {/* Scraping Status Banner */}
              {kalshiScrapingDate && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/40 flex items-center gap-3"
                >
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-400">
                      Scraping for date and markets...
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {kalshiStreaming
                        ? "Streaming live updates"
                        : "Fetching initial data"}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Streaming Status Banner */}
              {kalshiStreaming &&
                !kalshiLoading &&
                kalshiMarkets.length > 0 &&
                !kalshiScrapingDate && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/40 flex items-center gap-3"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-400">
                        Discovering more markets...
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Please don't refresh - new fixtures are being added
                        automatically
                      </p>
                    </div>
                  </motion.div>
                )}

              {/* Show error banner if there's an error but we have markets */}
              {kalshiError && kalshiMarkets.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 text-sm">
                  {kalshiError} (showing {kalshiMarkets.length} market
                  {kalshiMarkets.length !== 1 ? "s" : ""} from cache/streaming)
                </div>
              )}

              {kalshiLoading && kalshiMarkets.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-400">Loading Kalshi markets...</div>
                </div>
              ) : kalshiError &&
                kalshiMarkets.length === 0 &&
                !kalshiScrapingDate ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="text-red-400 mb-2">Error loading markets</div>
                  <div className="text-sm text-gray-500 text-center max-w-md">
                    {kalshiError}
                  </div>
                  <button
                    onClick={() => {
                      setKalshiLoading(true);
                      fetch("/api/kalshi/markets")
                        .then((res) => res.json())
                        .then((data: KalshiMarketsResponse) => {
                          if (data.error) {
                            let errorMsg = data.error;
                            if (data.debug) {
                              console.log("Kalshi API Debug Info:", data.debug);
                              if (
                                data.debug.sample_tickers &&
                                data.debug.sample_tickers.length > 0
                              ) {
                                errorMsg += `\n\nSample tickers found: ${data.debug.sample_tickers
                                  .slice(0, 5)
                                  .join(", ")}`;
                              }
                            }
                            setKalshiError(errorMsg);
                            setKalshiMarkets([]);
                          } else {
                            setKalshiMarkets(data.markets || []);
                            setKalshiError(null);
                          }
                          setKalshiLoading(false);
                        })
                        .catch((error) => {
                          setKalshiError(
                            error.message || "Failed to fetch Kalshi markets"
                          );
                          setKalshiLoading(false);
                        });
                    }}
                    className="mt-4 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : kalshiMarkets.length === 0 && !kalshiScrapingDate ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="text-gray-400 mb-2">
                    No Kalshi markets found
                  </div>
                  <div className="text-xs text-gray-500 text-center max-w-md">
                    This could mean:
                    <ul className="list-disc list-inside mt-2 text-left">
                      <li>No active EPL markets on Kalshi right now</li>
                      <li>Markets use a different ticker format</li>
                      <li>Check the browser console for more details</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => {
                      setKalshiLoading(true);
                      fetch("/api/kalshi/markets")
                        .then((res) => res.json())
                        .then((data: KalshiMarketsResponse) => {
                          if (data.error) {
                            let errorMsg = data.error;
                            if (data.debug) {
                              console.log("Kalshi API Debug Info:", data.debug);
                              if (
                                data.debug.sample_tickers &&
                                data.debug.sample_tickers.length > 0
                              ) {
                                errorMsg += `\n\nSample tickers found: ${data.debug.sample_tickers
                                  .slice(0, 5)
                                  .join(", ")}`;
                              }
                            }
                            setKalshiError(errorMsg);
                            setKalshiMarkets([]);
                          } else {
                            setKalshiMarkets(data.markets || []);
                            setKalshiError(null);
                          }
                          setKalshiLoading(false);
                        })
                        .catch((error) => {
                          setKalshiError(
                            error.message || "Failed to fetch Kalshi markets"
                          );
                          setKalshiLoading(false);
                        });
                    }}
                    className="mt-4 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                (() => {
                  // Group markets by match (same teams, same date) and deduplicate
                  const groupedMarkets = new Map<string, KalshiMarket[]>();
                  const seenMarketIds = new Set<string>(); // Track seen market IDs to prevent duplicates

                  kalshiMarkets.forEach((market) => {
                    // Skip if we've already seen this market ID
                    const marketId = market.market_id || market.ticker;
                    if (seenMarketIds.has(marketId)) {
                      return; // Skip duplicate
                    }
                    seenMarketIds.add(marketId);

                    const tickerInfo = market.ticker_info;
                    // Use team codes for consistent grouping (they're always in same order in ticker)
                    const team1 = tickerInfo.team1 || "";
                    const team2 = tickerInfo.team2 || "";
                    const date = tickerInfo.date || "";

                    // Create a unique key for the match using date and team codes
                    // Team codes are consistent across all markets for the same match
                    const matchKey = `${date}-${team1}-${team2}`;

                    if (!groupedMarkets.has(matchKey)) {
                      groupedMarkets.set(matchKey, []);
                    }
                    groupedMarkets.get(matchKey)!.push(market);
                  });

                  // Filter each group to only include the 3 main markets (Team1 Wins, Team2 Wins, Tie)
                  const filteredGroups = new Map<string, KalshiMarket[]>();

                  groupedMarkets.forEach((markets, matchKey) => {
                    if (markets.length === 0) return;

                    const firstMarket = markets[0];
                    const tickerInfo = firstMarket.ticker_info;
                    const team1Code = tickerInfo.team1 || "";
                    const team2Code = tickerInfo.team2 || "";
                    const team1Name = tickerInfo.team1_full || team1Code;
                    const team2Name = tickerInfo.team2_full || team2Code;

                    // Find the 3 main markets: Team1 Wins, Team2 Wins, Tie
                    const team1Win = markets.find((m) => {
                      const prop = m.ticker_info.prop || "";
                      return (
                        prop === team1Code ||
                        m.ticker_info.prop_full?.includes(
                          team1Name + " Wins"
                        ) ||
                        m.ticker_info.bet_description?.includes(
                          team1Name + " Wins"
                        )
                      );
                    });

                    const team2Win = markets.find((m) => {
                      const prop = m.ticker_info.prop || "";
                      return (
                        prop === team2Code ||
                        m.ticker_info.prop_full?.includes(
                          team2Name + " Wins"
                        ) ||
                        m.ticker_info.bet_description?.includes(
                          team2Name + " Wins"
                        )
                      );
                    });

                    const tie = markets.find((m) => {
                      const prop = m.ticker_info.prop || "";
                      return (
                        prop === "TIE" ||
                        prop === "DRAW" ||
                        m.ticker_info.prop_full === "Tie/Draw" ||
                        m.ticker_info.bet_description?.includes("Tie/Draw")
                      );
                    });

                    // Only include the 3 main markets, filter out others
                    const mainMarkets = [team1Win, team2Win, tie].filter(
                      Boolean
                    ) as KalshiMarket[];

                    if (mainMarkets.length > 0) {
                      filteredGroups.set(matchKey, mainMarkets);
                    }
                  });

                  // Convert to array and render grouped cards
                  return Array.from(filteredGroups.entries()).map(
                    ([matchKey, markets]) => (
                      <KalshiMatchCard
                        key={matchKey}
                        markets={markets}
                        isExpanded={expandedKalshiMarkets.has(matchKey)}
                        onToggle={() => toggleKalshiMarket(matchKey)}
                      />
                    )
                  );
                })()
              )}
            </>
          ) : columnType === "manifold" ? (
            <>
              {/* Show error banner if there's an error but we have markets */}
              {manifoldError && manifoldMarkets.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 text-sm">
                  {manifoldError} (showing {manifoldMarkets.length} market
                  {manifoldMarkets.length !== 1 ? "s" : ""} from cache)
                </div>
              )}

              {manifoldLoading && manifoldMarkets.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-400">
                    Loading Manifold markets...
                  </div>
                </div>
              ) : manifoldError && manifoldMarkets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="text-red-400 mb-2">Error loading markets</div>
                  <div className="text-sm text-gray-500 text-center max-w-md">
                    {manifoldError}
                  </div>
                  <button
                    onClick={() => {
                      setManifoldLoading(true);
                      fetch("/api/manifold/markets?startWeek=11&maxWeeks=20")
                        .then((res) => res.json())
                        .then((data: ManifoldMarketsResponse) => {
                          if (data.error && data.markets.length === 0) {
                            setManifoldError(data.error);
                          } else {
                            setManifoldMarkets(data.markets || []);
                            setManifoldError(null);
                          }
                          setManifoldLoading(false);
                        })
                        .catch((error) => {
                          setManifoldError(
                            error.message || "Failed to fetch Manifold markets"
                          );
                          setManifoldLoading(false);
                        });
                    }}
                    className="mt-4 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : manifoldMarkets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="text-gray-400 mb-2">
                    No Manifold markets found
                  </div>
                  <div className="text-xs text-gray-500 text-center max-w-md">
                    This could mean:
                    <ul className="list-disc list-inside mt-2 text-left">
                      <li>
                        No active EPL matchweek markets on Manifold right now
                      </li>
                      <li>Markets may not be created yet for upcoming weeks</li>
                      <li>Check the browser console for more details</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => {
                      setManifoldLoading(true);
                      fetch("/api/manifold/markets?startWeek=11&maxWeeks=20")
                        .then((res) => res.json())
                        .then((data: ManifoldMarketsResponse) => {
                          if (data.error && data.markets.length === 0) {
                            setManifoldError(data.error);
                          } else {
                            setManifoldMarkets(data.markets || []);
                            setManifoldError(null);
                          }
                          setManifoldLoading(false);
                        })
                        .catch((error) => {
                          setManifoldError(
                            error.message || "Failed to fetch Manifold markets"
                          );
                          setManifoldLoading(false);
                        });
                    }}
                    className="mt-4 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                manifoldMarkets
                  .filter((market) => {
                    // Filter out resolved markets
                    if (market.is_resolved) {
                      return false;
                    }
                    // Filter out markets with probability > 95% (essentially resolved) or <= 0% (no chance)
                    if (market.probability > 0.95 || market.probability <= 0) {
                      return false;
                    }
                    // Filter out markets that have passed (close_time in the past)
                    if (market.close_time) {
                      const currentTime = Date.now();
                      // Handle both milliseconds and seconds timestamps
                      const closeTime =
                        market.close_time > 1e12
                          ? market.close_time // Already in milliseconds
                          : market.close_time * 1000; // Convert seconds to milliseconds
                      if (closeTime < currentTime) {
                        return false;
                      }
                    }
                    return true;
                  })
                  .map((market) => {
                    // Use unique_id for each market entry
                    // since multiple matches can share the same market_id in a matchweek market
                    const uniqueKey =
                      market.unique_id ||
                      `${market.market_id}-${market.match_text}`;
                    return (
                      <ManifoldMatchCard
                        key={uniqueKey}
                        market={market}
                        isExpanded={expandedManifoldMarkets.has(uniqueKey)}
                        onToggle={() => toggleManifoldMarket(uniqueKey)}
                      />
                    );
                  })
              )}
            </>
          ) : (
            mockMatches.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                isExpanded={expandedMatches.has(match.id)}
                onToggle={() => toggleMatch(match.id)}
                columnType={columnType}
              />
            ))
          )}
        </div>
      </motion.div>
    );
  };

  // Determine which columns to show based on active page
  const getVisibleColumns = () => {
    if (activePage === "dashboard") {
      return ["tumfoolery", "kalshi", "manifold"];
    }
    if (
      activePage === "tumfoolery" ||
      activePage === "kalshi" ||
      activePage === "manifold"
    ) {
      return [activePage];
    }
    return [];
  };

  const visibleColumns = getVisibleColumns();

  const columnConfig = {
    tumfoolery: { title: "TUMfoolery", subtitle: "AI Model Predictions" },
    kalshi: { title: "Kalshi", subtitle: "Market Predictions" },
    manifold: { title: "Manifold", subtitle: "Market Predictions" },
  };

  // Compare page rendering
  if (activePage === "compare") {
    // Combine data from all sources for comparison
    const compareData: Array<{
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
    }> = [];

    // Create a map to group markets by match
    const matchMap = new Map<string, any>();

    // Add TUMfoolery markets
    mockMatches.forEach((match) => {
      const key = `${match.teamA.name}-${match.teamB.name}`;
      matchMap.set(key, {
        team1: match.teamA.name,
        team2: match.teamB.name,
        team1Logo: getTeamLogo(match.teamA.name),
        team2Logo: getTeamLogo(match.teamB.name),
        marketDescription: match.market,
        tumfooleryProb: match.tumfoolery.prediction,
      });
    });

    // Add Kalshi data
    kalshiMarkets.forEach((market) => {
      const tickerInfo = market.ticker_info;
      const team1 = tickerInfo.team1_full || tickerInfo.team1 || "";
      const team2 = tickerInfo.team2_full || tickerInfo.team2 || "";
      const key = `${team1}-${team2}`;

      if (matchMap.has(key)) {
        const existing = matchMap.get(key);
        existing.kalshiProb = market.yes_price;
        existing.kalshiVolume = market.volume;
      } else if (team1 && team2) {
        matchMap.set(key, {
          team1,
          team2,
          team1Logo: getTeamLogo(team1),
          team2Logo: getTeamLogo(team2),
          marketDescription:
            tickerInfo.bet_description || tickerInfo.prop_full || market.title,
          tumfooleryProb: 0.5, // Default if no TUMfoolery data
          kalshiProb: market.yes_price,
          kalshiVolume: market.volume,
        });
      }
    });

    // Add Manifold data
    manifoldMarkets.forEach((market) => {
      const key = `${market.team1}-${market.team2}`;

      if (matchMap.has(key)) {
        const existing = matchMap.get(key);
        existing.manifoldProb = market.probability;
        existing.manifoldVolume = market.volume;
      } else if (market.team1 && market.team2) {
        matchMap.set(key, {
          team1: market.team1,
          team2: market.team2,
          team1Logo: getTeamLogo(market.team1),
          team2Logo: getTeamLogo(market.team2),
          marketDescription: market.match_text,
          tumfooleryProb: 0.5, // Default if no TUMfoolery data
          manifoldProb: market.probability,
          manifoldVolume: market.volume,
        });
      }
    });

    compareData.push(...Array.from(matchMap.values()));

    return (
      <div className="min-h-screen bg-[#050505] relative overflow-hidden">
        <AnimatedBackground />
        {/* Bet Modal */}
        {betModalData && (
          <BetModal
            isOpen={betModalData.isOpen}
            onClose={() => setBetModalData(null)}
            team1={betModalData.team1}
            team2={betModalData.team2}
            marketDescription={betModalData.marketDescription}
            platform={betModalData.platform}
            odds={betModalData.odds}
            onConfirm={(amount) =>
              handleConfirmBet(
                amount,
                betModalData.team1,
                betModalData.team2,
                betModalData.marketDescription,
                betModalData.platform,
                betModalData.odds
              )
            }
          />
        )}
        <Sidebar activePage={activePage} onPageChange={setActivePage} />
        <div className="ml-72 p-8 relative z-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Compare Markets
            </h1>
            <p className="text-gray-400">
              Compare predictions across TUMfoolery, Kalshi, and Manifold to
              identify discrepancies and opportunities
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {compareData.map((data, index) => (
              <CompareMarketCard
                key={`${data.team1}-${data.team2}-${index}`}
                team1={data.team1}
                team2={data.team2}
                team1Logo={data.team1Logo}
                team2Logo={data.team2Logo}
                marketDescription={data.marketDescription}
                tumfooleryProb={data.tumfooleryProb}
                kalshiProb={data.kalshiProb}
                manifoldProb={data.manifoldProb}
                kalshiVolume={data.kalshiVolume}
                manifoldVolume={data.manifoldVolume}
                onSummarize={() => {
                  setSelectedMarketForChat(data);
                  setIsChatbotOpen(true);
                }}
                onBet={(platform, odds) => {
                  handleBet(
                    data.team1,
                    data.team2,
                    data.marketDescription,
                    platform,
                    odds
                  );
                }}
              />
            ))}
          </div>

          {compareData.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-400 mb-4">
                  No markets available for comparison
                </p>
                <button
                  onClick={() => setActivePage("dashboard")}
                  className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chatbot Panel */}
        {selectedMarketForChat && (
          <ChatbotPanel
            isOpen={isChatbotOpen}
            onClose={() => setIsChatbotOpen(false)}
            marketData={selectedMarketForChat}
          />
        )}
      </div>
    );
  }

  // Profile page rendering
  if (activePage === "profile") {
    return (
      <div className="min-h-screen bg-[#050505] relative overflow-hidden">
        <AnimatedBackground />
        <Sidebar activePage={activePage} onPageChange={setActivePage} />
        <div className="ml-72 relative z-10">
          <ProfilePage />
        </div>
      </div>
    );
  }

  // Dashboard view
  if (activePage === "dashboard") {
    // Calculate dashboard stats from real data
    const totalOpportunities = mockMatches.length;
    const positiveEVCount = mockMatches.filter(
      (m) => m.tumfoolery.expectedValue > 0
    ).length;
    const avgConfidence =
      mockMatches.reduce((sum, m) => sum + m.tumfoolery.confidence, 0) /
      mockMatches.length;

    // Calculate total volume from real Kalshi and Manifold markets
    // Only count volumes from markets that would actually be displayed (after filtering)

    // For Kalshi: Group by match and sum volume from the 3 main markets per match
    const kalshiMatchVolumes = new Map<string, number>();
    const seenKalshiMarketIds = new Set<string>();

    kalshiMarkets.forEach((market) => {
      const marketId = market.market_id || market.ticker;
      if (seenKalshiMarketIds.has(marketId)) {
        return; // Skip duplicates
      }
      seenKalshiMarketIds.add(marketId);

      const tickerInfo = market.ticker_info;
      const team1 = tickerInfo.team1 || "";
      const team2 = tickerInfo.team2 || "";
      const date = tickerInfo.date || "";
      const matchKey = `${date}-${team1}-${team2}`;

      if (matchKey && team1 && team2) {
        // Check if this is one of the 3 main markets (Team1 Win, Team2 Win, Tie)
        const prop = tickerInfo.prop || "";
        const team1Name = tickerInfo.team1_full || team1;
        const team2Name = tickerInfo.team2_full || team2;

        const isMainMarket =
          prop === team1 ||
          prop === team2 ||
          prop === "TIE" ||
          prop === "DRAW" ||
          tickerInfo.prop_full?.includes(team1Name + " Wins") ||
          tickerInfo.prop_full?.includes(team2Name + " Wins") ||
          tickerInfo.bet_description?.includes("Tie/Draw");

        if (isMainMarket) {
          const currentVolume = kalshiMatchVolumes.get(matchKey) || 0;
          kalshiMatchVolumes.set(
            matchKey,
            currentVolume + (market.volume || 0)
          );
        }
      }
    });

    const kalshiVolume = Array.from(kalshiMatchVolumes.values()).reduce(
      (sum, vol) => sum + vol,
      0
    );

    // For Manifold: Sum volume from markets that pass the filters (not resolved, not past, probability between 0-95%)
    const manifoldVolume = manifoldMarkets
      .filter((market) => {
        if (market.is_resolved) return false;
        if (market.probability > 0.95 || market.probability <= 0) return false;
        if (market.close_time) {
          const currentTime = Date.now();
          const closeTime =
            market.close_time > 1e12
              ? market.close_time
              : market.close_time * 1000;
          if (closeTime < currentTime) return false;
        }
        return true;
      })
      .reduce((sum, m) => sum + (m.volume || 0), 0);

    // Note: Kalshi is in dollars, Manifold is in MANA - we'll show Kalshi volume as total
    // and show Manifold separately in the subtitle
    const totalVolume = kalshiVolume; // Only Kalshi volume in dollars for total

    const bestEV = Math.max(
      ...mockMatches.map((m) => m.tumfoolery.expectedValue)
    );
    const bestMatch = mockMatches.find(
      (m) => m.tumfoolery.expectedValue === bestEV
    );

    // Count unique matches, not total markets
    // Kalshi: Group by match (same teams, same date) - each match has 3 markets (Team1 Win, Team2 Win, Tie)
    const kalshiUniqueMatches = new Set<string>();
    kalshiMarkets.forEach((market) => {
      const tickerInfo = market.ticker_info;
      const team1 = tickerInfo.team1 || "";
      const team2 = tickerInfo.team2 || "";
      const date = tickerInfo.date || "";
      const matchKey = `${date}-${team1}-${team2}`;
      if (matchKey && team1 && team2) {
        kalshiUniqueMatches.add(matchKey);
      }
    });
    const kalshiMarketCount = kalshiUniqueMatches.size;

    // Manifold: Each market entry is already a unique match
    const manifoldMarketCount = manifoldMarkets.length;

    return (
      <div className="min-h-screen bg-[#050505] relative overflow-hidden">
        <AnimatedBackground />
        {/* Wallet Connect Modal */}
        <WalletConnectModal
          isOpen={isWalletModalOpen}
          onClose={() => setIsWalletModalOpen(false)}
          onConnect={handleWalletConnect}
        />
        <Sidebar activePage={activePage} onPageChange={setActivePage} />
        <div className="ml-72 relative z-10">
          {/* Top Bar */}
          <div className="p-8 pb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-gray-400">
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span className="text-sm">Search opportunities</span>
              </div>
              {walletInfo.connected ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-green-500/10 border border-green-500/30">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm text-green-400 font-medium font-mono">
                    {walletInfo.address?.slice(0, 6)}...
                    {walletInfo.address?.slice(-4)}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/15 transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="px-8 pb-8 space-y-6">
            {/* Row 1: Best Opportunity Card, Stats */}
            <div className="grid grid-cols-12 gap-6">
              {/* Best Opportunity Card - Large */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-7 rounded-3xl border border-white/20 p-8 bg-black/40 backdrop-blur-xl relative overflow-hidden"
                style={{
                  boxShadow:
                    "0 8px 32px rgba(34, 197, 94, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                }}
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-sm text-gray-400 mb-2">
                        Best Opportunity
                      </p>
                      <h2 className="text-4xl font-bold text-white mb-1">
                        <span className="text-green-400">
                          +{(bestEV * 100).toFixed(1)}%
                        </span>{" "}
                        Expected Value
                      </h2>
                      {bestMatch && (
                        <p className="text-lg text-gray-300 mt-2">
                          {bestMatch.teamA.name} vs {bestMatch.teamB.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setActivePage("tumfoolery")}
                    className="px-6 py-3 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-400 font-semibold hover:bg-green-500/30 transition-colors"
                  >
                    View All Opportunities
                  </button>
                </div>
              </motion.div>

              {/* Active Matches Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-5 rounded-3xl border border-white/20 p-6 bg-black/40 backdrop-blur-xl flex flex-col items-center justify-center"
              >
                <p className="text-sm text-gray-400 mb-3">Active Matches</p>
                <p className="text-5xl font-bold text-white">
                  {totalOpportunities}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {positiveEVCount} with positive EV
                </p>
              </motion.div>
            </div>

            {/* Row 2: Stats Grid */}
            <div className="grid grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl border border-white/20 p-6 bg-black/40 backdrop-blur-xl"
              >
                <p className="text-xs text-gray-400 mb-2">Model Accuracy</p>
                <p className="text-3xl font-bold text-white">
                  {(avgConfidence * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-green-400 mt-1">↑ 2.3% this week</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-3xl border border-white/20 p-6 bg-black/40 backdrop-blur-xl"
              >
                <p className="text-xs text-gray-400 mb-2">Total Volume</p>
                <p className="text-3xl font-bold text-white">
                  {totalVolume >= 1000000
                    ? `$${(totalVolume / 1000000).toFixed(1)}M`
                    : totalVolume >= 1000
                    ? `$${(totalVolume / 1000).toFixed(0)}K`
                    : `$${totalVolume.toFixed(0)}`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {kalshiVolume > 0 && manifoldVolume > 0
                    ? `Kalshi: $${(kalshiVolume / 1000).toFixed(
                        0
                      )}K • Manifold: ${(manifoldVolume / 1000).toFixed(
                        0
                      )}K MANA`
                    : kalshiVolume > 0
                    ? `Kalshi: $${(kalshiVolume / 1000).toFixed(0)}K`
                    : manifoldVolume > 0
                    ? `Manifold: ${(manifoldVolume / 1000).toFixed(0)}K MANA`
                    : "No active markets"}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-3xl border border-white/20 p-6 bg-black/40 backdrop-blur-xl"
              >
                <p className="text-xs text-gray-400 mb-2">Kalshi Markets</p>
                <p className="text-3xl font-bold text-white">
                  {kalshiMarketCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">Active</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-3xl border border-white/20 p-6 bg-black/40 backdrop-blur-xl"
              >
                <p className="text-xs text-gray-400 mb-2">Manifold Markets</p>
                <p className="text-3xl font-bold text-white">
                  {manifoldMarketCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">Active</p>
              </motion.div>
            </div>

            {/* Row 3: TUMfoolery Upcoming Bets and Market Performance */}
            <div className="grid grid-cols-3 gap-6">
              {/* TUMfoolery Upcoming Bets */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-3xl border border-white/20 p-6 bg-black/40 backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                    <Image
                      src="/logo.svg"
                      alt="TUMfoolery"
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    TUMfoolery
                  </h3>
                </div>
                <div className="space-y-3">
                  {mockMatches.map((match) => (
                    <div
                      key={match.id}
                      onClick={() => setActivePage("tumfoolery")}
                      className="p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 relative">
                          <Image
                            src={getTeamLogo(match.teamA.name)}
                            alt={match.teamA.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                        <span className="text-xs text-gray-400 break-words">
                          {match.teamA.name.length > 8
                            ? match.teamA.name.substring(0, 8) + "..."
                            : match.teamA.name}{" "}
                          vs{" "}
                          {match.teamB.name.length > 8
                            ? match.teamB.name.substring(0, 8) + "..."
                            : match.teamB.name}
                        </span>
                        <span
                          className={`text-xs font-semibold ml-auto ${
                            match.tumfoolery.expectedValue > 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {match.tumfoolery.expectedValue > 0 ? "+" : ""}
                          {(match.tumfoolery.expectedValue * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-sm text-white font-medium truncate">
                        {match.market}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Confidence:{" "}
                        {(match.tumfoolery.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Kalshi Market Performance Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-3xl border border-white/20 p-6 bg-black/40 backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                    <Image
                      src="/kalshi.png"
                      alt="Kalshi"
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Kalshi</h3>
                </div>
                <div className="space-y-3">
                  {kalshiMarkets.length > 0 ? (
                    // Group markets by game (same base ticker)
                    (() => {
                      const groupedMarkets = new Map<string, KalshiMarket[]>();
                      kalshiMarkets.forEach((market) => {
                        const tickerInfo = market.ticker_info;
                        const baseTicker = market.ticker
                          .split("-")
                          .slice(0, 2)
                          .join("-");
                        if (!groupedMarkets.has(baseTicker)) {
                          groupedMarkets.set(baseTicker, []);
                        }
                        groupedMarkets.get(baseTicker)!.push(market);
                      });

                      // Get first 5 unique games
                      const displayMarkets = Array.from(groupedMarkets.values())
                        .slice(0, 5)
                        .map((group) => group[0]); // Take first market from each group

                      return displayMarkets.map((market, index) => {
                        const tickerInfo = market.ticker_info;
                        const team1Name =
                          tickerInfo.team1_full || tickerInfo.team1 || "Team 1";
                        const team2Name =
                          tickerInfo.team2_full || tickerInfo.team2 || "Team 2";
                        const team1Logo = getTeamLogo(team1Name);
                        const team2Logo = getTeamLogo(team2Name);
                        const formatPriceCents = (value: number) =>
                          `${Math.round(value * 100)}¢`;

                        return (
                          <div
                            key={market.market_id || market.ticker || index}
                            onClick={() => setActivePage("kalshi")}
                            className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 relative">
                                <Image
                                  src={team1Logo}
                                  alt={team1Name}
                                  fill
                                  className="object-contain"
                                />
                              </div>
                              <span className="text-xs text-gray-400 break-words">
                                {team1Name.length > 10
                                  ? team1Name.substring(0, 10) + "..."
                                  : team1Name}{" "}
                                vs{" "}
                                {team2Name.length > 10
                                  ? team2Name.substring(0, 10) + "..."
                                  : team2Name}
                              </span>
                              <span className="text-xs font-semibold ml-auto text-gray-300">
                                {formatPriceCents(market.yes_price)}
                              </span>
                            </div>
                            <p className="text-xs text-white font-medium truncate">
                              {tickerInfo.bet_description ||
                                tickerInfo.prop_full ||
                                market.title}
                            </p>
                            {market.volume > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Vol: ${(market.volume / 1000).toFixed(0)}K
                              </p>
                            )}
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-500 mb-2">
                        No Kalshi markets available
                      </p>
                      <button
                        onClick={() => setActivePage("kalshi")}
                        className="text-xs text-purple-400 hover:text-purple-300 underline"
                      >
                        Go to Kalshi page
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Manifold Market Performance Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-3xl border border-white/20 p-6 bg-black/40 backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                    <Image
                      src="/manifold.png"
                      alt="Manifold"
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Manifold</h3>
                </div>
                <div className="space-y-3">
                  {manifoldMarkets.length > 0 ? (
                    manifoldMarkets.slice(0, 5).map((market) => {
                      const team1Logo = getTeamLogo(market.team1);
                      const team2Logo = getTeamLogo(market.team2);
                      const formatPercentage = (value: number) =>
                        `${(value * 100).toFixed(0)}%`;

                      return (
                        <div
                          key={market.market_id}
                          onClick={() => setActivePage("manifold")}
                          className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 relative">
                              <Image
                                src={team1Logo}
                                alt={market.team1}
                                fill
                                className="object-contain"
                              />
                            </div>
                            <span className="text-xs text-gray-400 break-words">
                              {market.team1.length > 10
                                ? market.team1.substring(0, 10) + "..."
                                : market.team1}{" "}
                              vs{" "}
                              {market.team2.length > 10
                                ? market.team2.substring(0, 10) + "..."
                                : market.team2}
                            </span>
                            <span className="text-xs font-semibold ml-auto text-gray-300">
                              {formatPercentage(market.probability)}
                            </span>
                          </div>
                          <p className="text-xs text-white font-medium truncate">
                            {market.match_text}
                          </p>
                          {market.volume > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Vol:{" "}
                              {market.volume >= 1000
                                ? `${(market.volume / 1000).toFixed(0)}K`
                                : market.volume.toFixed(0)}{" "}
                              MANA
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-500 mb-2">
                        No Manifold markets available
                      </p>
                      <button
                        onClick={() => setActivePage("manifold")}
                        className="text-xs text-purple-400 hover:text-purple-300 underline"
                      >
                        Go to Manifold page
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activePage === "history") { 
    return (
      <div className="min-h-screen bg-[#050505] relative overflow-hidden">
        <AnimatedBackground />
        <Sidebar activePage={activePage} onPageChange={setActivePage} />
        <div className="ml-72 p-8 relative z-10">
          <HistoryPage />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      <AnimatedBackground />
      <Sidebar activePage={activePage} onPageChange={setActivePage} />
      <div className="ml-72 p-8 relative z-10">
        {visibleColumns.length > 0 ? (
          <div
            className={`grid gap-6 w-full ${
              visibleColumns.length === 3
                ? "grid-cols-3"
                : visibleColumns.length === 2
                ? "grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {visibleColumns.map((columnType) => (
              <div key={columnType}>
                {renderColumn(
                  columnType as "tumfoolery" | "kalshi" | "manifold",
                  columnConfig[columnType as keyof typeof columnConfig].title,
                  columnConfig[columnType as keyof typeof columnConfig].subtitle
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-screen">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h2 className="text-3xl font-bold text-white mb-2">
                {activePage.charAt(0).toUpperCase() + activePage.slice(1)}
              </h2>
              <p className="text-gray-400">Coming soon...</p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
