import { hashPassword, verifyPassword } from './password';

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function hashPin(pin: string): string {
  return hashPassword(`pin:${pin}`);
}

export function verifyPin(pin: string, pinHash: string | undefined): boolean {
  if (!pinHash) return false;
  return verifyPassword(`pin:${pin}`, pinHash);
}
