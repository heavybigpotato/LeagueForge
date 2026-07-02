import type { User } from './types'
import { newId } from './ids'

/**
 * Account creation and identity verification. LeagueForge has no fake
 * pre-loaded users: every account is created through this flow and must
 * verify email and phone before it can create or join a team.
 *
 * In the local build there is no mail/SMS gateway, so the generated codes
 * are surfaced in the UI (clearly labelled as demo delivery). The rules —
 * codes must match, verification gates roster actions — are the real ones.
 */

export interface PendingVerification {
  emailCode: string
  phoneCode: string
}

export function newVerificationCode(random: () => number = Math.random): string {
  return String(Math.floor(random() * 900000) + 100000) // 6 digits, no leading zero
}

export interface SignUpInput {
  username: string
  email: string
  phone: string
}

export function validateSignUp(input: SignUpInput, existing: User[]): void {
  const username = input.username.trim()
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) {
    throw new Error('Username must be 3–20 characters: letters, numbers, underscores.')
  }
  if (existing.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('That username is taken on this device.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw new Error('Enter a valid email address.')
  }
  if (existing.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())) {
    throw new Error('An account with this email already exists on this device.')
  }
  const digits = input.phone.replace(/[^\d]/g, '')
  if (digits.length < 7 || digits.length > 15) {
    throw new Error('Enter a valid phone number.')
  }
}

export function createAccount(
  input: SignUpInput,
  existing: User[],
  now: number = Date.now(),
): { user: User; verification: PendingVerification } {
  validateSignUp(input, existing)
  const user: User = {
    id: newId('user'),
    username: input.username.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    emailVerified: false,
    phoneVerified: false,
    idVerified: false,
    deviceFingerprint: deviceFingerprint(),
    reputation: 100,
    createdAt: now,
  }
  return { user, verification: { emailCode: newVerificationCode(), phoneCode: newVerificationCode() } }
}

export function verifyEmail(user: User, verification: PendingVerification, code: string): User {
  if (code.trim() !== verification.emailCode) throw new Error('That email code is not correct.')
  return { ...user, emailVerified: true }
}

export function verifyPhone(user: User, verification: PendingVerification, code: string): User {
  if (code.trim() !== verification.phoneCode) throw new Error('That phone code is not correct.')
  return { ...user, phoneVerified: true }
}

function deviceFingerprint(): string {
  try {
    return `fp_${(navigator.userAgent.length * 31 + screen.width * 7 + screen.height).toString(36)}`
  } catch {
    return `fp_${newId('dev')}`
  }
}
