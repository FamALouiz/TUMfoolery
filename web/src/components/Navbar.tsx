"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User as UserIcon } from "lucide-react";

export default function Navbar() {
  const [activePage, setActivePage] = useState("Dashboard");
  const { data: session } = useSession();

  const navItems = ["Dashboard", "My Bets", "Profile"];

  return (
    <nav className="w-full bg-transparent backdrop-blur-md sticky top-0 z-50 overflow-hidden border-b border-white/20">
      {/* Grain texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
      <div className="w-full px-8 py-4 flex items-center justify-between relative z-10">
        {/* Logo/Title */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-bold text-white"
        >
          Bet PL
        </motion.div>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          {navItems.map((item, index) => {
            const isActive = activePage === item;
            return (
              <motion.button
                key={item}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                onClick={() => setActivePage(item)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all relative ${
                  isActive ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-white/10 rounded-lg border border-white/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{item}</span>
              </motion.button>
            );
          })}

          {/* User Menu */}
          {session?.user && (
            <div className="ml-4 flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white">
                  {session.user.name || session.user.email}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/auth/login" })}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
