import { nextGenRotationEngine } from "./hybridRotationEngine";

export async function executeGeminiExtraction(
  prompt: string,
  apiKey: string,
  pushLog?: (msg: string, isError?: boolean) => void
) {
  const url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  const modelId = nextGenRotationEngine?.geminiModel || "gemini-3.5-flash";
  const payload = {
    model: modelId,
    messages: [{ role: "user", content: prompt }],
  };

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
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
    if (res.status === 404 && pushLog) {
      pushLog(
        `[404 DEBUG] Failed URL: ${url} | Model Passed: ${modelId} | Headers: ${JSON.stringify(headers)} | Payload: ${JSON.stringify(payload)}`,
        true
      );
    }

    try {
      await fetch("/api/usage/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gemini", model: modelId, latency, status: "error" })
      });
    } catch(e) {}

    const err = new Error(`Gemini API Error: ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  try {
    await fetch("/api/usage/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", model: modelId, latency, status: "success" })
    });
  } catch(e) {}

  const data = await res.json();
  return data.choices[0].message.content;
}
