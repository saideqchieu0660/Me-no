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

// Replace executeGenerateContentRoundRobin(prompt)
code = code.replace(/executeGenerateContentRoundRobin\(([^,]+)\)/g, 'executeGenerateContentRoundRobin($1, { byokKey: req?.headers["x-cerebras-key"] || req?.headers["x-byok-key"] || req?.headers["authorization"]?.replace("Bearer ","") })');

// Replace executeGenerateContentRoundRobin(prompt, {
code = code.replace(/executeGenerateContentRoundRobin\(([^,]+),\s*\{/g, 'executeGenerateContentRoundRobin($1, { byokKey: req?.headers["x-cerebras-key"] || req?.headers["x-byok-key"] || req?.headers["authorization"]?.replace("Bearer ",""),');

// Remove groq and openrouter sections
code = code.replace(/if \(provider === "groq"\) \{[\s\S]*?if \(provider === "openrouter"\) \{[\s\S]*?\} catch \(e: any\) \{/m, '} catch (e: any) {');

fs.writeFileSync('server.ts', code);
