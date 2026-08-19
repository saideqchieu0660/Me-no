const fs = require('fs');
let code = fs.readFileSync('src/pages/TeacherDashboard.tsx', 'utf8');
code = code.replace(/user\?\.uid/g, 'user?.id');
fs.writeFileSync('src/pages/TeacherDashboard.tsx', code);
console.log("Fixed user?.uid in TeacherDashboard.tsx");
