const fs = require('fs');

const filePath = 'src/components/DeckList.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const target = `      const { collection, getDocs, writeBatch } = await import("firebase/firestore");
      
      const setsRef = collection(db, "sets");
      const querySnapshot = await getDocs(setsRef);`;

const replacement = `      const { collection, getDocs, writeBatch, query, where } = await import("firebase/firestore");
      const currentUser = store.getCurrentUser();
      if (!currentUser) return;
      
      const setsRef = collection(db, "sets");
      const q = query(setsRef, where("createdBy", "==", currentUser.id));
      const querySnapshot = await getDocs(q);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Fixed DeckList.tsx");
} else {
  console.log("Target not found in " + filePath);
}
