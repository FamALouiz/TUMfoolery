"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet } from "lucide-react";

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletType: string, address: string) => void;
}

const walletProviders = [
  {
    name: "MetaMask",
    icon: "🦊",
    color: "from-orange-500/20 to-yellow-500/20",
  },
  {
    name: "WalletConnect",
    icon: "🔗",
    color: "from-blue-500/20 to-cyan-500/20",
  },
  {
    name: "Coinbase Wallet",
    icon: "💼",
    color: "from-indigo-500/20 to-blue-500/20",
  },
  { name: "Phantom", icon: "👻", color: "from-purple-500/20 to-pink-500/20" },
  {
    name: "Trust Wallet",
    icon: "🛡️",
    color: "from-cyan-500/20 to-blue-500/20",
  },
];

export default function WalletConnectModal({
  isOpen,
  onClose,
  onConnect,
}: WalletConnectModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleWalletSelect = async (walletType: string) => {
    setIsConnecting(true);

    // Mock wallet connection - generate a random wallet address
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const mockAddress = `0x${Math.random().toString(16).substring(2, 42)}`;

    onConnect(walletType, mockAddress);
    setIsConnecting(false);
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
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center mb-4">
                  <Wallet className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Connect Wallet
                </h2>
                <p className="text-gray-400 text-sm">
                  Choose your preferred wallet provider to start betting
                </p>
              </div>

              {/* Wallet Options */}
              <div className="space-y-3">
                {walletProviders.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={() => handleWalletSelect(wallet.name)}
                    disabled={isConnecting}
                    className={`w-full p-4 rounded-xl bg-gradient-to-r ${wallet.color} border border-white/10 hover:border-white/20 transition-all duration-200 flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed group`}
                  >
                    <div className="text-3xl">{wallet.icon}</div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">{wallet.name}</p>
                      <p className="text-xs text-gray-400">
                        {isConnecting
                          ? "Connecting..."
                          : "Connect with " + wallet.name}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <p className="text-xs text-blue-400">
                  🔒 <strong>Mock Connection:</strong> This is a demonstration.
                  No actual wallet connection will be made.
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
