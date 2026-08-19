const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the 404 error inside /api/config/key-usage-sync with a success response for BYOK keys
code = code.replace(
  /if \(\!matchedState\) \{\s*return res\.status\(404\)\.json\(\{ error: `Key not found on server pool for provider: \$\{provider\}` \}\);\s*\}/,
  `if (!matchedState) {
        // BYOK keys won't be in the server pool, just acknowledge sync
        return res.json({ success: true, message: "BYOK key usage noted." });
      }`
);

fs.writeFileSync('server.ts', code);
