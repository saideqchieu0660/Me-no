import { safeRequest } from "../utils/apiClient";
import { auth } from "../lib/firebase";

export async function optimizeFormatting(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text;
  
  try {
    const idToken = (await auth.currentUser?.getIdToken()) || "";
    const res = await safeRequest("/api/formatting/optimize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error("Failed to optimize formatting");
    }

    const data = await res.json();
    if (data.success && data.result) {
      // Validate: check if length is somewhat similar to avoid AI hallucinaton wiping out text
      const originalLength = text.replace(/\\s/g, '').length;
      const newLength = data.result.replace(/\\s/g, '').length;
      
      // Allow some small difference because of punctuation or special character handling,
      // but if the new length is completely different, we reject it.
      if (Math.abs(originalLength - newLength) > originalLength * 0.2) {
        console.warn("AI formatting validation failed: length changed too much");
        return text; 
      }
      return data.result;
    }
    return text;
  } catch (err) {
    console.error("Optimize formatting error:", err);
    return text;
  }
}


export async function optimizeFormattingBatch(texts: string[]): Promise<string[]> {
  if (!texts || texts.length === 0) return [];
  
  // To avoid exceeding AI limits or getting bad JSON, process in chunks of 10
  const CHUNK_SIZE = 10;
  let finalResults: string[] = [];
  const idToken = (await auth.currentUser?.getIdToken()) || "";

  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE);
    
    try {
      const res = await safeRequest("/api/formatting/optimize-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ texts: chunk }),
      });

      if (!res.ok) {
        throw new Error("Failed to optimize formatting batch");
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        // Validation loop
        const validatedChunk = data.results.map((formattedResult: string, idx: number) => {
           const orig = chunk[idx];
           const originalLength = orig.replace(/\s/g, '').length;
           const newLength = formattedResult.replace(/\s/g, '').length;
           if (Math.abs(originalLength - newLength) > originalLength * 0.2) {
             console.warn("AI formatting validation failed for a card: length changed too much");
             return orig; 
           }
           return formattedResult;
        });
        finalResults.push(...validatedChunk);
      } else {
        finalResults.push(...chunk);
      }
    } catch (err) {
      console.error("Optimize formatting batch error:", err);
      finalResults.push(...chunk);
    }
  }

  return finalResults;
}
