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
  password: string
}

/**
 * Salted, iterated hash (cyrb-style) for the local build — accounts on a
 * device are protected and switching identities requires the password.
 * A production backend would use argon2/bcrypt server-side.
 */
export function hashPassword(password: string, salt: string): string {
  let h1 = 0xdeadbeef ^ salt.length
  let h2 = 0x41c6ce57 ^ password.length
  const str = `${salt}::${password}::${salt}`
  for (let round = 0; round < 300; round++) {
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i) + round
      h1 = Math.imul(h1 ^ ch, 2654435761)
      h2 = Math.imul(h2 ^ ch, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  }
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

/** True when the password matches the account's stored hash. */
export function checkPassword(user: User, password: string): boolean {
  return hashPassword(password, user.passwordSalt) === user.passwordHash
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
  if (input.password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }
}

export function createAccount(
  input: SignUpInput,
  existing: User[],
  now: number = Date.now(),
): { user: User; verification: PendingVerification } {
  validateSignUp(input, existing)
  const passwordSalt = newId('salt') + Math.random().toString(36).slice(2)
  const user: User = {
    id: newId('user'),
    username: input.username.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    passwordHash: hashPassword(input.password, passwordSalt),
    passwordSalt,
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
