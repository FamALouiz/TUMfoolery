'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { LayoutDashboard, ChevronRight, History, User, BarChart3, GitCompare } from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function Sidebar({ activePage, onPageChange }: SidebarProps) {
  const [isMarketsExpanded, setIsMarketsExpanded] = useState(true);

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      subItems: null,
    },
    {
      id: 'markets',
      label: 'Markets',
      icon: BarChart3,
      subItems: [
        { name: 'TUMfoolery', icon: '/TUM.svg' },
        { name: 'Kalshi', icon: '/kalshi.png' },
        { name: 'Manifold', icon: '/manifold.png' },
      ],
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: GitCompare,
      subItems: null,
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      subItems: null,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      subItems: null,
    },
  ];

  const handleItemClick = (item: typeof menuItems[0]) => {
    if (item.subItems) {
      setIsMarketsExpanded(!isMarketsExpanded);
    } else {
      onPageChange(item.id);
    }
  };

  const isActive = (itemId: string) => {
    if (itemId === 'markets') {
      return activePage === 'tumfoolery' || activePage === 'kalshi' || activePage === 'manifold';
    }
    return activePage === itemId;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-black/50 backdrop-blur-2xl border-r border-white/5 z-50 flex flex-col">
      {/* Logo Section */}
      <div className="p-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">T</span>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">TUMfoolery</span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-6 space-y-1 overflow-y-auto">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const itemIsActive = isActive(item.id);
          const hasSubItems = item.subItems !== null;

          return (
            <div key={item.id}>
              <button
                onClick={() => handleItemClick(item)}
                className={`w-full relative transition-colors duration-200 ${
                  itemIsActive ? 'text-white' : 'text-gray-500'
                }`}
              >
                {/* Active indicator */}
                {itemIsActive && (
                  <motion.div
                    layoutId="activeSidebarItem"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}

                <div className="relative flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {hasSubItems && (
                    <motion.div
                      animate={{ rotate: isMarketsExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  )}
                </div>
              </button>

              {/* Sub-items */}
              {hasSubItems && (
                <AnimatePresence>
                  {isMarketsExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-8 mt-1 space-y-1"
                    >
                      {Array.isArray(item.subItems) && item.subItems.map((subItem) => {
                        const subItemId = subItem.name.toLowerCase();
                        const subItemIsActive = activePage === subItemId;

                        return (
                          <button
                            key={subItem.name}
                            onClick={() => onPageChange(subItemId)}
                            className={`w-full relative transition-colors duration-200 ${
                              subItemIsActive ? 'text-white' : 'text-gray-500'
                            }`}
                          >
                            {/* Active indicator for sub-item */}
                            {subItemIsActive && (
                              <motion.div
                                layoutId="activeSubItem"
                                className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                              />
                            )}

                            <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200">
                              <div className="w-5 h-5 relative flex-shrink-0">
                                <Image
                                  src={subItem.icon}
                                  alt={subItem.name}
                                  fill
                                  className="object-contain"
                                />
                              </div>
                              <span className="font-medium text-xs">{subItem.name}</span>
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-6 border-t border-white/5">
        <div className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-xs text-gray-500 mb-1">Wallet</p>
          <p className="text-sm font-semibold text-white">0x1234...5678</p>
        </div>
      </div>
    </aside>
  );
}
