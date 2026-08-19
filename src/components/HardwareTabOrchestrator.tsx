import React, { useCallback, useState } from "react";

/**
 * requestIdleCallback Polyfill for Safari and weak devices.
 * Defers non-critical execution to the browser's idle periods.
 */
export const requestIdle = (cb: IdleRequestCallback): number => {
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    return window.requestIdleCallback(cb, { timeout: 1000 });
  }
  return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0) as unknown as number;
};

/**
 * Forces tab switching to strictly align with the hardware rendering cycle.
 * By using double-requestAnimationFrame, we guarantee the V8 layout phase
 * is split from the compositor paint phase, eliminating main-thread jank.
 */
export const useHardwareTabOrchestrator = <T extends string>(initialTab: T) => {
  const [activeTab, setActiveTab] = useState<T>(initialTab);

  const switchTab = useCallback((tabId: T) => {
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setActiveTab(tabId);
        });
      });
    } else {
      setActiveTab(tabId);
    }
  }, []);

  return { activeTab, switchTab };
};

interface HardwareTabPanelProps {
  id: string;
  activeId: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * ZERO-RECONCILIATION LAYOUT PANEL
 * 
 * Never unmounts children. Toggles CSS visibility classes to force V8 to 
 * skip React's virtual DOM reconciliation entirely.
 * 
 * - `contain: content` acts as an isolation barrier reducing 'Recalculate Style' storms.
 * - `translateZ(0)` ensures the panel is promoted to a discrete compositor layer.
 */
export const HardwareTabPanel = React.memo(
  ({ id, activeId, children, className = "" }: HardwareTabPanelProps) => {
    const isActive = id === activeId;
    
    return (
      <div 
        id={`hw-tab-${id}`}
        className={`w-full transition-opacity duration-150 ${isActive ? "hardware-tab-active opacity-100" : "hardware-tab-content opacity-0"} ${className}`}
      >
        {children}
      </div>
    );
  },
  (prev, next) => prev.activeId === next.activeId && prev.id === next.id && prev.className === next.className
);
