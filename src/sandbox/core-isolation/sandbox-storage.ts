// @sandbox-feature: True
// @data-isolation: STRICT_MOCK_ONLY
// @target-core-override: None
// # REGION SANDBOX - DO NOT TOUCH CORE

export const SandboxStorage = {
  setItem: (key: string, value: string) => {
    localStorage.setItem(`sb_${key}`, value);
  },
  getItem: (key: string) => {
    return localStorage.getItem(`sb_${key}`);
  },
  removeItem: (key: string) => {
    localStorage.removeItem(`sb_${key}`);
  },
  clear: () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb_')) {
        localStorage.removeItem(key);
      }
    });
  },
};
