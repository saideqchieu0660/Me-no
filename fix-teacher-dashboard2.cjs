const fs = require('fs');

const filePath = 'src/pages/TeacherDashboard.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const targetUsers = `        const q = query(collection(db, "users"), limit(100));
        const { query, where } = await import("firebase/firestore");
        const q = query(collection(db, "sets"), where("createdBy", "==", user.uid));
        const unsub = onSnapshot(
          q,
          (snapshot) => {`;

const replacementUsers = `        const q = query(collection(db, "users"), limit(100));
        const unsub = onSnapshot(
          q,
          (snapshot) => {`;
          
if (code.includes(targetUsers)) {
   code = code.replace(targetUsers, replacementUsers);
   console.log("Restored users query");
} else {
   console.log("Failed to restore users query");
}

const targetSets = `        const unsub = onSnapshot(
          collection(db, "sets"),
          (snapshot) => {`;
          
const replacementSets = `        const { query, where } = await import("firebase/firestore");
        const qSets = query(collection(db, "sets"), where("createdBy", "==", user.uid));
        const unsub = onSnapshot(
          qSets,
          (snapshot) => {`;
          
if (code.includes(targetSets)) {
   code = code.replace(targetSets, replacementSets);
   console.log("Fixed sets query");
} else {
   console.log("Failed to fix sets query");
}

fs.writeFileSync(filePath, code);

