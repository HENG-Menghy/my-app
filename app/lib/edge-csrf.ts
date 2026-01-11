// @/lib/edge-csrf.ts

/**
 * @edge-csrf/core library
 * https://www.npmjs.com/package/@edge-csrf/core
 *
 * @reference https://dev.to/rwx222/csrf-tokens-in-nextjs-3mlb
*/

import {
  createToken,
  verifyToken,
  atou,
  utoa,
} from "@edge-csrf/core";

const SALT_LENGTH = 77; // Random number (1 to 255)

// Reuse stable secret
const secretUint8Array: Uint8Array = atou(process.env.CSRF_SECRET!);

export async function generateCSRFtoken(): Promise<string> {
  const tokenUint8Array = await createToken(
    secretUint8Array,
    SALT_LENGTH
  );
  return utoa(tokenUint8Array);
}

export async function verifyCSRFtoken(token: string): Promise<boolean> {
  try {
    const tokenUint8Array = atou(token);
    return await verifyToken(tokenUint8Array, secretUint8Array);
  } catch {
    return false;
  }
}
