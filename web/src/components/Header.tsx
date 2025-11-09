'use client';

import { TrendingUp, Target, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter';

export default function Header() {
  return (
    <div className="mb-8 relative z-10">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-5xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent"
      >
        Alpha Dashboard
      </motion.h1>
      <div className="flex gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex-1 glass rounded-xl border border-purple-500/20 p-5 flex items-center gap-4 hover:border-purple-500/40 transition-all duration-300 hover:scale-[1.02] group"
        >
          <div className="p-3 bg-gradient-to-br from-purple-500/30 to-purple-600/20 rounded-xl group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Live Opportunities</p>
            <p className="text-3xl font-bold text-white">
              <AnimatedCounter value={3} />
            </p>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 glass rounded-xl border border-green-500/20 p-5 flex items-center gap-4 hover:border-green-500/40 transition-all duration-300 hover:scale-[1.02] group"
        >
          <div className="p-3 bg-gradient-to-br from-green-500/30 to-green-600/20 rounded-xl group-hover:scale-110 transition-transform">
            <Target className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Highest EV</p>
            <p className="text-3xl font-bold text-green-400">
              +<AnimatedCounter value={25.0} suffix="%" />
            </p>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex-1 glass rounded-xl border border-blue-500/20 p-5 flex items-center gap-4 hover:border-blue-500/40 transition-all duration-300 hover:scale-[1.02] group"
        >
          <div className="p-3 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl group-hover:scale-110 transition-transform">
            <BarChart3 className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Model Accuracy</p>
            <p className="text-3xl font-bold text-blue-400">
              <AnimatedCounter value={87.3} suffix="%" />
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
