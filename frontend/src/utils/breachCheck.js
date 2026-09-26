// Checks a password against the "Have I Been Pwned" breach database using
// the k-anonymity range API: only the first 5 characters of the password's
// SHA-1 hash are ever sent over the network, so the real password (or even
// its full hash) never leaves the browser.
// Docs: https://haveibeenpwned.com/API/v3#PwnedPasswords

async function sha1Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * @param {string} password
 * @returns {Promise<{breached: boolean, count: number} | {error: string}>}
 */
export async function checkPasswordBreach(password) {
  if (!password) return { breached: false, count: 0 };

  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });

    if (!res.ok) {
      return { error: `HIBP request failed (${res.status})` };
    }

    const text = await res.text();
    const line = text.split("\n").find((row) => row.startsWith(suffix));

    if (!line) return { breached: false, count: 0 };

    const count = parseInt(line.split(":")[1], 10) || 0;
    return { breached: count > 0, count };
  } catch (err) {
    return { error: err?.message || "Network error while checking breach status" };
  }
}

/**
 * Checks a list of {id, password} pairs with limited concurrency so we
 * don't fire dozens of parallel requests at once.
 */
export async function checkManyPasswords(items, concurrency = 4, onProgress) {
  const results = {};
  let index = 0;
  let done = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      // eslint-disable-next-line no-await-in-loop
      results[current.id] = await checkPasswordBreach(current.password);
      done += 1;
      onProgress?.(done, items.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
