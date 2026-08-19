const fs = require('fs');

// Fix TeacherDashboard.tsx
let dashboard = fs.readFileSync('src/pages/TeacherDashboard.tsx', 'utf8');
dashboard = dashboard.replace(/user\.uid/g, 'user?.id');
fs.writeFileSync('src/pages/TeacherDashboard.tsx', dashboard);
console.log("Fixed TeacherDashboard.tsx");

// Fix PomodoroStore.ts
let pomodoro = fs.readFileSync('src/lib/PomodoroStore.ts', 'utf8');
const targetPomo = `  useEffect(() => {
    return pomodoroStore.subscribe(setState);
  }, []);`;
const replacementPomo = `  useEffect(() => {
    const unsubscribe = pomodoroStore.subscribe(setState);
    return () => { unsubscribe(); };
  }, []);`;
if (pomodoro.includes(targetPomo)) {
  pomodoro = pomodoro.replace(targetPomo, replacementPomo);
  fs.writeFileSync('src/lib/PomodoroStore.ts', pomodoro);
  console.log("Fixed PomodoroStore.ts");
} else {
  console.log("Target not found in PomodoroStore.ts");
}
