const fs = require('fs');

const filePath = 'src/pages/TeacherDashboard.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const startMarker = 'const unsub = onSnapshot(';
const endMarker = '(snapshot) => {';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const blockToReplace = code.substring(startIndex, endIndex);
  
  const replacement = `const { query, where } = await import("firebase/firestore");
        const q = query(collection(db, "sets"), where("createdBy", "==", user.uid));
        const unsub = onSnapshot(
          q,
          `;
          
  code = code.replace(blockToReplace, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Fixed TeacherDashboard.tsx");
} else {
  console.log("Markers not found in " + filePath);
}
