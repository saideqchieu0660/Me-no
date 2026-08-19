import { nextGenRotationEngine } from "./hybridRotationEngine";

export async function executeCerebrasExtraction(
  prompt: string,
  apiKey: string,
  pushLog?: (msg: string, isError?: boolean) => void
) {
  // Rerouted to Gemini 1.5 Flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const modelId = "gemini-1.5-flash";

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
  };

  const headers = {
    "Content-Type": "application/json",
  };

  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const latency = Date.now() - start;

  if (!res.ok) {
    if (pushLog) {
      pushLog(
        `[DEBUG] Failed URL: ${url} | Model Passed: ${modelId}`,
        true
      );
    }
    
    // Log failure
    try {
      await fetch("/api/usage/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gemini", model: modelId, latency, status: "error" })
      });
    } catch(e) {}

    const errText = await res.text();
    const err = new Error(`Gemini API Error: ${res.status} - ${errText}`);
    (err as any).status = res.status;
    throw err;
  }

  // Log success
  try {
    await fetch("/api/usage/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", model: modelId, latency, status: "success" })
    });
  } catch(e) {}

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}
