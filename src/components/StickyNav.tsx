import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

export interface NavItem {
  id: string;
  title: string;
  onClick?: () => void;
}

interface StickyNavProps {
  sections: NavSection[];
  activeSectionId: string | null;
  onSectionClick: (id: string) => void;
  onItemClick?: (sectionId: string, itemId: string) => void;
}

export const StickyNav: React.FC<StickyNavProps> = ({ sections, activeSectionId, onSectionClick, onItemClick }) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div 
      ref={navRef}
      className="sticky top-0 z-50 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 shadow-sm transition-all mb-8"
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
          {sections.map((section) => {
            const isActive = activeSectionId === section.id;
            const isOpen = openDropdown === section.id;

            return (
              <div key={section.id} className="relative shrink-0 group">
                <button
                  onClick={() => {
                    if (isOpen) {
                      setOpenDropdown(null);
                    } else {
                      setOpenDropdown(section.id);
                    }
                    onSectionClick(section.id);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                    isActive 
                      ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20" 
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
                  )}
                >
                  {section.title}
                  {section.items.length > 0 && (
                    <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                  )}
                </button>

                <AnimatePresence>
                  {isOpen && section.items.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-[60]"
                    >
                      <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
                        {section.items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setOpenDropdown(null);
                              if (item.onClick) item.onClick();
                              if (onItemClick) onItemClick(section.id, item.id);
                            }}
                            className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors line-clamp-2"
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex items-center justify-between py-3">
          <div className="font-bold text-zinc-800 dark:text-zinc-200">
            {sections.find(s => s.id === activeSectionId)?.title || "Điều hướng"}
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden"
          >
            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
              {sections.map((section) => (
                <div key={section.id} className="space-y-2">
                  <button
                    onClick={() => {
                      onSectionClick(section.id);
                      if (section.items.length === 0) setIsMobileMenuOpen(false);
                      else setOpenDropdown(openDropdown === section.id ? null : section.id);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-left",
                      activeSectionId === section.id
                        ? "bg-orange-500/10 text-orange-600"
                        : "bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {section.title}
                    {section.items.length > 0 && (
                      <ChevronDown className={cn("w-5 h-5 transition-transform", openDropdown === section.id && "rotate-180")} />
                    )}
                  </button>

                  <AnimatePresence>
                    {openDropdown === section.id && section.items.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-4 space-y-1 overflow-hidden"
                      >
                        {section.items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              if (item.onClick) item.onClick();
                              if (onItemClick) onItemClick(section.id, item.id);
                            }}
                            className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            {item.title}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
