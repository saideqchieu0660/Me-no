// @sandbox-feature: True
// @data-isolation: STRICT_MOCK_ONLY
// @target-core-override: None
// # REGION SANDBOX - DO NOT TOUCH CORE

export const sandboxFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlString = input.toString();

  // Block any attempts to access core API or production Firestore directly via fetch
  if (urlString.includes('/api/v1') || urlString.includes('firestore.googleapis.com')) {
    const errorMsg = `[SANDBOX VIOLATION RED-FLAG]: Core Mutation Attempted at ${urlString}!`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Rewrite /api/* to /api/sandbox/* to ensure we hit isolated endpoints if they exist
  if (urlString.startsWith('/api/') && !urlString.startsWith('/api/sandbox/')) {
    const sandboxUrl = urlString.replace('/api/', '/api/sandbox/');
    return fetch(sandboxUrl, init);
  }

  return fetch(input, init);
};

// Sandbox mock wrapper for Firebase Firestore if needed
export const sandboxDb = {
  collection: (path: string) => {
    if (!path.startsWith('sb_')) {
      const errorMsg = `[SANDBOX VIOLATION RED-FLAG]: Core Firestore Collection Mutation Attempted at /${path}!`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    // Return mock reference or isolated logic
    return { path };
  }
};
