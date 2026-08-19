const fs = require('fs');

function fixFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Find the exact block we want to replace
  const startMarker = 'const { getDocs, collection } = await import("firebase/firestore");';
  const endMarker = 'const homePath =';
  
  const startIndex = code.indexOf(startMarker);
  const endIndex = code.indexOf(endMarker, startIndex);
  
  if (startIndex !== -1 && endIndex !== -1) {
    const blockToReplace = code.substring(startIndex, endIndex);
    
    const replacement = `// OPTIMIZATION: Avoid full table scan by using locally cached decks from store
            const allLocalDecks = store.getDecks();
            const allCards: any[] = [];
            allLocalDecks.forEach((data) => {
              if (data && Array.isArray(data.cards)) {
                  data.cards.forEach((c: any) => {
                    allCards.push({
                      ...c,
                      originDeckId: data.id,
                      originDeckTitle: data.title,
                    });
                  });
              }
            });
            
            `;
            
    code = code.replace(blockToReplace, replacement);
    fs.writeFileSync(filePath, code);
    console.log("Fixed Daily Quest in " + filePath);
  } else {
    console.log("Markers not found in " + filePath);
  }
}

fixFile('src/vibe-sandbox/VibeStudyRoom.tsx');
fixFile('src/pages/LegacyStudyRoom.tsx');

