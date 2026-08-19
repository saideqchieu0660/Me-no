export type PomodoroMode = 'work' | 'break';

export interface PomodoroState {
  isEnabled: boolean;
  isActive: boolean;
  mode: PomodoroMode;
  workTime: number; // in seconds
  breakTime: number; // in seconds
  timeLeft: number;
  isBreakLocked: boolean;
}

export type PomodoroListener = (state: PomodoroState) => void;

class PomodoroGlobalStore {
  private state: PomodoroState;
  private listeners: Set<PomodoroListener> = new Set();
  private interval: NodeJS.Timeout | null = null;

  constructor() {
    const isEnabled = localStorage.getItem('henosis_deepwork') === 'true';
    const workTime = parseInt(localStorage.getItem('henosis_pomodoro_work') || String(25 * 60));
    const breakTime = parseInt(localStorage.getItem('henosis_pomodoro_break') || String(5 * 60));
    
    this.state = {
      isEnabled,
      isActive: false,
      mode: 'work',
      workTime,
      breakTime,
      timeLeft: workTime,
      isBreakLocked: false,
    };
  }

  subscribe(listener: PomodoroListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  private updateState(partial: Partial<PomodoroState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  setIsEnabled(enabled: boolean) {
    localStorage.setItem('henosis_deepwork', enabled.toString());
    this.updateState({ isEnabled: enabled });
    if (!enabled) {
      this.stop();
    }
  }

  setWorkTimeMinutes(minutes: number) {
    const newSeconds = minutes * 60;
    localStorage.setItem('henosis_pomodoro_work', newSeconds.toString());
    
    const partial: Partial<PomodoroState> = { workTime: newSeconds };
    if (this.state.mode === 'work' && !this.state.isActive) {
      partial.timeLeft = newSeconds;
    }
    this.updateState(partial);
  }

  setBreakTimeMinutes(minutes: number) {
    const newSeconds = minutes * 60;
    localStorage.setItem('henosis_pomodoro_break', newSeconds.toString());
    
    const partial: Partial<PomodoroState> = { breakTime: newSeconds };
    if (this.state.mode === 'break' && !this.state.isActive) {
      partial.timeLeft = newSeconds;
    }
    this.updateState(partial);
  }

  toggleTimer() {
    if (this.state.isActive) {
      this.pause();
    } else {
      this.start();
    }
  }

  start() {
    if (!this.state.isActive && this.state.timeLeft > 0) {
      this.updateState({ isActive: true });
      this.interval = setInterval(() => this.tick(), 1000);
    }
  }

  pause() {
    if (this.state.isActive) {
      this.updateState({ isActive: false });
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
    }
  }

  stop() {
    this.pause();
    this.updateState({
      mode: 'work',
      timeLeft: this.state.workTime,
      isBreakLocked: false
    });
  }

  skipBreak() {
    this.updateState({
      mode: 'work',
      timeLeft: this.state.workTime,
      isActive: false,
      isBreakLocked: false
    });
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private tick() {
    if (this.state.timeLeft > 0) {
      this.updateState({ timeLeft: this.state.timeLeft - 1 });
    } else {
      // Time is up
      this.pause();
      if (this.state.mode === 'work') {
        this.updateState({
          mode: 'break',
          timeLeft: this.state.breakTime,
          isBreakLocked: true
        });
        
        try {
          new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
        } catch(e) {}

        // --- GHI NHẬN POMODORO THÀNH CÔNG VÀO LOCALSTORAGE ---
        try {
          const statsStr = localStorage.getItem('vibe_pomodoro_stats');
          const today = new Date().toISOString().split('T')[0];
          let stats = statsStr ? JSON.parse(statsStr) : {};
          
          if (!stats[today]) stats[today] = { count: 0, timeSpent: 0 };
          stats[today].count += 1;
          // Tính thời gian dựa trên workTime
          stats[today].timeSpent += Math.floor(this.state.workTime / 60);
          
          localStorage.setItem('vibe_pomodoro_stats', JSON.stringify(stats));
          window.dispatchEvent(new Event('vibe_pomodoro_updated'));
        } catch (err) {
          console.error("Failed to save Pomodoro session stats:", err);
        }

      } else {
        this.updateState({
          mode: 'work',
          timeLeft: this.state.workTime,
          isBreakLocked: false
        });
        try {
          new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3').play().catch(() => {});
        } catch(e) {}
      }
    }
  }
}

export const pomodoroStore = new PomodoroGlobalStore();

import { useState, useEffect } from 'react';

export function usePomodoro() {
  const [state, setState] = useState<PomodoroState>(() => {
    // Hack to get initial state synchronously
    let initialState: PomodoroState | undefined;
    pomodoroStore.subscribe((s) => initialState = s)();
    return initialState!;
  });

  useEffect(() => {
    const unsubscribe = pomodoroStore.subscribe(setState);
    return () => { unsubscribe(); };
  }, []);

  return {
    ...state,
    setIsEnabled: (v: boolean) => pomodoroStore.setIsEnabled(v),
    setWorkTimeMinutes: (m: number) => pomodoroStore.setWorkTimeMinutes(m),
    setBreakTimeMinutes: (m: number) => pomodoroStore.setBreakTimeMinutes(m),
    toggleTimer: () => pomodoroStore.toggleTimer(),
    stopTimer: () => pomodoroStore.stop(),
    skipBreak: () => pomodoroStore.skipBreak()
  };
}
