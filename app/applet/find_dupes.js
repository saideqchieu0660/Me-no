const fs = require('fs');

const data = fs.readFileSync('src/lib/store.ts', 'utf-8');
const idMatches = data.match(/id:\s*"[^"]+"/g);

if (idMatches) {
    const counts = {};
    for (const match of idMatches) {
        counts[match] = (counts[match] || 0) + 1;
    }
    
    for (const [id, count] of Object.entries(counts)) {
        if (count > 1) {
            console.log("DUPLICATE:", id, count);
        }
    }
}
