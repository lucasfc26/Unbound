import { randomInt } from 'crypto';

// Excludes 0/O/1/I/L — characters easily confused with each other when read aloud or typed.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

/** Stored dash-less (e.g. "AB3D9F2K"); the frontend adds a "AB3D-9F2K" dash purely for display. */
export function generateFriendCode(): string {
  let code = '';
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function normalizeFriendCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
