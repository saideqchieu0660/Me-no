import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../src/lib/utils";

interface VibeDropdownProps {
  isOpen: boolean;
  children: React.ReactNode;
}

const VibeDropdown: React.FC<VibeDropdownProps> = ({ isOpen, children }) => {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-visible"
        >
          <div className="pt-4 pb-12 overflow-visible">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export interface VibeNavGroupProps {
  id: string;
  title: string;
  isOpen?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

export const VibeNavGroup: React.FC<VibeNavGroupProps> = ({ id, title, isOpen = false, onToggle, children, headerActions }) => {
  return (
    <div className={cn("relative w-full overflow-visible", isOpen ? "z-20" : "z-10")} id={`vibe-section-${id}`} data-section-id={id}>
      <div 
        className={cn(
          "sticky top-4 z-[40] w-full transition-all duration-300 cursor-pointer rounded-2xl overflow-hidden shadow-lg",
          isOpen ? "backdrop-blur-xl bg-slate-900 border-2 border-orange-500/50 ring-4 ring-orange-500/20" : "bg-slate-900 backdrop-blur-md border border-zinc-800 shadow-sm hover:border-orange-500/50"
        )}
        onClick={onToggle}
      >
        <div className="w-full flex items-center justify-between py-4 px-5 sm:px-6 group">
          <h3 className={cn(
            "text-xl sm:text-2xl font-black transition-colors tracking-tight line-clamp-1 mr-4",
            isOpen ? "text-orange-400" : "text-white group-hover:text-orange-500"
          )}>
            {title}
          </h3>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {headerActions && (
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                {headerActions}
              </div>
            )}
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-slate-700 transition-colors shrink-0">
              <ChevronDown className={cn(
                "w-6 h-6 text-zinc-500 transition-transform duration-300",
                isOpen ? "rotate-180 text-orange-500" : ""
              )} />
            </div>
          </div>
        </div>
      </div>
      <VibeDropdown isOpen={isOpen}>
        {children}
      </VibeDropdown>
    </div>
  );
};

interface VibeStickyStudyNavProps {
  children: React.ReactElement<VibeNavGroupProps> | React.ReactElement<VibeNavGroupProps>[];
  defaultOpenId?: string;
}

export const VibeStickyStudyNav: React.FC<VibeStickyStudyNavProps> = ({ children, defaultOpenId }) => {
  const childrenArray = React.Children.toArray(children) as React.ReactElement<VibeNavGroupProps>[];
  const firstId = childrenArray.length > 0 ? childrenArray[0].props.id : null;
  const [openSectionId, setOpenSectionId] = useState<string | null>(defaultOpenId || null);

  const handleToggle = (id: string) => {
    setOpenSectionId(prev => prev === id ? null : id);
    
    if (openSectionId !== id) {
      setTimeout(() => {
        const element = document.getElementById(`section-${id}`);
        if (element) {
          const y = element.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 250); // wait for animation
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col space-y-6">
      {childrenArray.map((child) => 
        React.cloneElement(child, {
          isOpen: openSectionId === child.props.id,
          onToggle: () => handleToggle(child.props.id)
        })
      )}
    </div>
  );
};
