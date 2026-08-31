// Some browsers (Safari Private Browsing, strict cookie/tracking-protection
// settings) throw a SecurityError the moment localStorage is touched instead
// of just being unavailable — window.localStorage still exists, but any
// get/set/remove call throws. These wrappers swallow that so the app degrades
// to "nothing stored" instead of crashing.

export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked — nothing we can do, ignore.
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage blocked — nothing we can do, ignore.
  }
}
