import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Coffee, Lock } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { usePomodoro } from '../lib/PomodoroStore';

export const DeepWorkTimer = () => {
    const { 
        isEnabled, 
        isActive, 
        timeLeft, 
        mode, 
        isBreakLocked, 
        toggleTimer, 
        stopTimer, 
        skipBreak 
    } = usePomodoro();
    
    const location = useLocation();

    if (!isEnabled) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (location.pathname === '/auth' || location.pathname === '/setup-profile' || location.pathname === '/verify' || location.pathname.includes('/study')) {
        return null;
    }

    return (
        <>
            {/* The Floating Widget */}
            <motion.div 
                drag 
                dragMomentum={false}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="fixed bottom-6 left-6 z-[900] cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
            >
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-zinc-200 shadow-xl dark:border-zinc-800 p-4 flex flex-col gap-3 min-w-[180px]">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-500 cursor-pointer">
                        <span className="flex items-center gap-1.5">
                            {mode === 'work' ? <Lock className="w-3.5 h-3.5 text-orange-500" /> : <Coffee className="w-3.5 h-3.5 text-blue-500" />}
                            {mode === 'work' ? 'Deep Work' : 'Nghỉ Ngơi'}
                        </span>
                        <span>{isActive ? '⏳' : '⏸️'}</span>
                    </div>
                    
                    <div className="text-3xl font-mono font-bold text-center text-zinc-900 dark:text-zinc-100 tabular-nums my-1 select-none">
                        {formatTime(timeLeft)}
                    </div>
                    
                    <div className="flex items-center justify-center gap-2">
                        <button 
                            onClick={toggleTimer} 
                            className={`p-2 rounded-xl transition-all shadow-sm ${isActive ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                        >
                            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button 
                            onClick={stopTimer} 
                            className="p-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-all hover:bg-zinc-300 dark:hover:bg-zinc-700 shadow-sm"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <div className="text-[10px] text-center text-zinc-400 font-medium">
                        Kéo thả để di chuyển
                    </div>
                </div>
            </motion.div>

            {/* The Enforced Break Screen Lock */}
            <AnimatePresence>
                {isBreakLocked && (
                    <motion.div 
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
                        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        transition={{ duration: 0.5 }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-6 text-center shadow-2xl"
                        style={{ pointerEvents: 'all' }}
                    >
                        <motion.div 
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="max-w-md w-full flex flex-col items-center gap-6"
                        >
                            <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                                <Coffee className="w-10 h-10 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-display font-bold text-white mb-2">Đã Đến Giờ Nghỉ!</h2>
                                <p className="text-zinc-400 text-sm leading-relaxed">
                                    Thư giãn mắt. Hãy đứng lên và vươn vai. Ngành khoa học kognitive yêu cầu ngài nghỉ ngơi để não bộ củng cố kiến thức. 
                                </p>
                            </div>
                            
                            <div className="text-6xl font-mono font-black text-blue-400 tabular-nums">
                                {formatTime(timeLeft)}
                            </div>
                            
                            <div className="mt-8 flex flex-col gap-3 w-full">
                                <button 
                                    onClick={skipBreak}
                                    className="w-full py-4 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition font-bold"
                                >
                                    Bỏ qua giờ nghỉ (Không khuyến khích)
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
