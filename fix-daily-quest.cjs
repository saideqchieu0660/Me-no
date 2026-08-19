const fs = require('fs');

function fixFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  const target = `            const { getDocs, collection } = await import("firebase/firestore");
            const snapshot = await getDocs(collection(db, "sets"));

            const allCards: any[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as any;
              if (data && Array.isArray(data.cards)) {
                const systemDecks = [
                  "deck_1",
                  "deck_phil_2",
                  "deck_math_1",
                  "deck_math_2",
                  "deck_physics_1",
                  "deck_physics_2",
                  "deck_test_ui",
                  "deck_formatting_test",
                ];
                const isSystem = systemDecks.includes(data.id);
                const isCreatedBySelf = user && data.createdBy === user.id;
                const isCreatedByTeacher =
                  data.creatorRole === "teacher" ||
                  data.creatorRole === "Admin" ||
                  data.creatorRole === "admin";
                const isUserTeacher =
                  user &&
                  (user.role === "teacher" ||
                    user.role === "Admin" ||
                    user.role === "admin");
                if (
                  isSystem ||
                  isCreatedBySelf ||
                  isUserTeacher ||
                  isCreatedByTeacher
                ) {
                  allCards.push(
                    ...data.cards.map((c: any) => ({
                      ...c,
                      originDeckId: data.id,
                      originDeckTitle: data.title,
                    })),
                  );
                }
              }
            });`;

  const replacement = `            // OPTIMIZATION: Avoid full table scan by using locally cached decks from store
            const allLocalDecks = store.getDecks();
            const allCards: any[] = [];
            allLocalDecks.forEach((data) => {
              if (data && Array.isArray(data.cards)) {
                  allCards.push(
                    ...data.cards.map((c: any) => ({
                      ...c,
                      originDeckId: data.id,
                      originDeckTitle: data.title,
                    })),
                  );
              }
            });`;

  if (code.includes(target)) {
     code = code.replace(target, replacement);
     fs.writeFileSync(filePath, code);
     console.log("Fixed Daily Quest in " + filePath);
  } else {
     console.log("Target not found in " + filePath);
  }
}

fixFile('src/vibe-sandbox/VibeStudyRoom.tsx');
fixFile('src/pages/LegacyStudyRoom.tsx');

