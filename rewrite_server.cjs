const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Replace activeProviders logic inside executeGenerateContentRoundRobin
code = code.replace(
  /let activeProviders: string\[\] = \[\];[\s\S]*?let finalError: any = null;/m,
  `let activeProviders: string[] = ["gemini"];\n\n  let finalError: any = null;`
);

// Add byok support to the gemini block
code = code.replace(
  /const \{ ai, state \} = getGeminiClient\(\);\s*const response = await ai\.models\.generateContent\(\{/m,
  `let ai;
          let state;
          if (config.byokKey) {
             const h = getSpoofedHeaders();
             ai = new GoogleGenAI({
               apiKey: config.byokKey,
               httpOptions: {
                  headers: {
                    "User-Agent": h["User-Agent"],
                    "X-Forwarded-For": h["X-Forwarded-For"],
                    "X-Real-IP": h["X-Real-IP"],
                    "X-Client-IP": h["X-Client-IP"],
                    "CF-Connecting-IP": h["CF-Connecting-IP"],
                    "True-Client-IP": h["True-Client-IP"],
                    "X-Originating-IP": h["X-Originating-IP"],
                    "Forwarded": h["Forwarded"]
                  }
               }
             });
          } else {
             const clientInfo = getGeminiClient();
             ai = clientInfo.ai;
             state = clientInfo.state;
          }
          const response = await ai.models.generateContent({`
);

// Remove groq and openrouter sections
code = code.replace(/if \(provider === "groq"\) \{[\s\S]*?if \(provider === "openrouter"\) \{[\s\S]*?\} catch \(e: any\) \{/m, '} catch (e: any) {');

// Fix key sync endpoint
code = code.replace(
  /if \(\!matchedState\) \{\s*return res\.status\(404\)\.json\(\{ error: `Key not found on server pool for provider: \$\{provider\}` \}\);\s*\}/,
  `if (!matchedState) {
        // BYOK keys won't be in the server pool, just acknowledge sync
        return res.json({ success: true, message: "BYOK key usage noted." });
      }`
);

// Carefully replace executeGenerateContentRoundRobin calls to include byokKey
// Only match the actual function calls, not arbitrary text
const newCall1 = 'executeGenerateContentRoundRobin($1, Object.assign({}, $2, { byokKey: req?.headers["x-cerebras-key"] || req?.headers["x-byok-key"] || (req?.headers["authorization"] || "").replace("Bearer ","") }))';

const newCall2 = 'executeGenerateContentRoundRobin($1, { byokKey: req?.headers["x-cerebras-key"] || req?.headers["x-byok-key"] || (req?.headers["authorization"] || "").replace("Bearer ","") })';

// Replace `executeGenerateContentRoundRobin(arg1, arg2)`
code = code.replace(/executeGenerateContentRoundRobin\(([^,]+?),\s*(\{[^}]*?\})\)/g, newCall1);

// Replace `executeGenerateContentRoundRobin(arg1)`
code = code.replace(/executeGenerateContentRoundRobin\(([^,]+?)\)/g, newCall2);

// Let's fix the recursive execution signature: 
code = code.replace(/async function executeGenerateContentRoundRobin\([^)]*\)\s*:/g, 
  'async function executeGenerateContentRoundRobin(contents: any, config: any = {}):');

// Ensure that `executeGenerateContentRoundRobin(contents: any, config: any = {}):` definition wasn't modified incorrectly by the previous replacements
code = code.replace(/async function executeGenerateContentRoundRobin\(contents: any, \{ byokKey:[^)]*\)\s*:/, 'async function executeGenerateContentRoundRobin(contents: any, config: any = {}):');
code = code.replace(/async function executeGenerateContentRoundRobin\(contents: any, Object\.assign\([^)]*\)\s*:/, 'async function executeGenerateContentRoundRobin(contents: any, config: any = {}):');
code = code.replace(/executeGenerateContentRoundRobin\(contents: any, config: any = \{\}, \{ byokKey:[^)]*\)\s*:/, 'async function executeGenerateContentRoundRobin(contents: any, config: any = {}):');

fs.writeFileSync('server.ts', code);
