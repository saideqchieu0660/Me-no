const fs = require('fs');
let content = fs.readFileSync('src/vibe-sandbox/VibeStudyCompanion.tsx', 'utf8');

// Replace the old Pomodoro lifecycle and functions
content = content.replace(/\/\/ --- POMODORO LIFECYCLE ---[\s\S]*?\/\/ --- BREATHING 4-7-8 LIFECYCLE ---/, '// --- BREATHING 4-7-8 LIFECYCLE ---');

// Replace UI variables
content = content.replace(/timerMode === "pomo"/g, 'mode === "work"');
content = content.replace(/timerMode === "short"/g, 'false /* short handled globally */');
content = content.replace(/timerMode === "long"/g, 'false /* long handled globally */');
content = content.replace(/timerMode/g, 'mode');

content = content.replace(/isTimerRunning/g, 'isActive');
content = content.replace(/toggleTimerActive/g, 'toggleTimer');
content = content.replace(/resetTimer/g, 'stopTimer');

// Fix the onClick handlers for time preset buttons to use setWorkTimeMinutes/setBreakTimeMinutes
content = content.replace(/setTimerMode\("pomo"\)/g, 'setWorkTimeMinutes(25)');
content = content.replace(/setTimerMode\("short"\)/g, 'setWorkTimeMinutes(5)');
content = content.replace(/setTimerMode\("long"\)/g, 'setWorkTimeMinutes(60)');

fs.writeFileSync('src/vibe-sandbox/VibeStudyCompanion.tsx', content);
