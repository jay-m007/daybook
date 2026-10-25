// Optional passphrase lock. The journal is encrypted with AES-256-GCM using a key made from your passphrase (PBKDF2, 600,000 rounds).
// Nothing is stored except the scrambled text, a random salt and a random number used once per save.
// If you forget the passphrase there is no reset: nobody, including the author, can read the journal without it.
const enc = new TextEncoder(), dec = new TextDecoder();
const ITER = 600000;
const subtle = () => { const c = globalThis.crypto; if (!c || !c.subtle) throw new Error("This browser cannot encrypt (it needs a secure page, https or localhost)."); return c; };

export const b64 = (u8) => { let s = ""; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(passphrase, salt, iterations = ITER) {
  const c = subtle();
  const base = await c.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return c.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Encrypt with a key you already derived (fast; do this on every save). */
export async function seal(key, salt, iterations, object) {
  const c = subtle();
  const iv = c.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await c.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(object))));
  return { v: 1, kdf: "PBKDF2-SHA256", iter: iterations, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** First time: pick a passphrase. Returns the vault to store plus the live key to keep in memory. */
export async function createVault(passphrase, object, iterations = ITER) {
  if (typeof passphrase !== "string" || passphrase.length < 8) throw new Error("Use at least 8 characters.");
  const salt = subtle().getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt, iterations);
  return { vault: await seal(key, salt, iterations, object), key, salt, iterations };
}

/** Unlock. Wrong passphrase or damaged data gives the same plain error. */
export async function openVault(passphrase, vault) {
  try {
    if (!vault || vault.v !== 1) throw new Error("bad");
    const salt = unb64(vault.salt), iterations = Number(vault.iter);
    if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 5e6) throw new Error("bad");
    const key = await deriveKey(passphrase, salt, iterations);
    const pt = await subtle().subtle.decrypt({ name: "AES-GCM", iv: unb64(vault.iv) }, key, unb64(vault.ct));
    return { object: JSON.parse(dec.decode(pt)), key, salt, iterations };
  } catch (e) {
    if (e && /secure page/.test(e.message)) throw e;
    throw new Error("That passphrase did not open the journal.");
  }
}
