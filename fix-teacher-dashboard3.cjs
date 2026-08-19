const fs = require('fs');

const filePath = 'src/pages/TeacherDashboard.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const target = `      const setsRef = collection(db, "sets");
      const querySnapshot = await getDocs(setsRef);`;

const replacement = `      const { query, where } = await import("firebase/firestore");
      const setsRef = collection(db, "sets");
      const q = query(setsRef, where("createdBy", "==", user?.uid));
      const querySnapshot = await getDocs(q);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Fixed TeacherDashboard 3");
} else {
  console.log("Not found");
}

