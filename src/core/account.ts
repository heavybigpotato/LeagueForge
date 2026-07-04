import type { User } from './types'
import { newId } from './ids'
import { PASSWORD_MIN_LENGTH, VERIFICATION } from './config'

/**
 * Account creation and identity verification. LeagueForge has no fake
 * pre-loaded users: every account is created through this flow and must
 * verify email and phone before it can create or join a team.
 *
 * In the local build there is no mail/SMS gateway, so the generated codes
 * are shown in the UI to complete signup. The rules — codes must match,
 * verification gates roster actions — are the real ones.
 */

export interface PendingVerification {
  emailCode: string
  phoneCode: string
  issuedAt: number
  /** Codes expire like real ones would; expired codes must be regenerated. */
  expiresAt: number
}

export function newVerificationCode(random: () => number = Math.random): string {
  const max = Math.pow(10, VERIFICATION.codeDigits)
  const min = max / 10
  return String(Math.floor(random() * (max - min)) + min) // fixed digits, no leading zero
}

/** Fresh pair of on-device verification codes with an expiry window from config. */
export function newVerification(now: number = Date.now()): PendingVerification {
  return {
    emailCode: newVerificationCode(),
    phoneCode: newVerificationCode(),
    issuedAt: now,
    expiresAt: now + VERIFICATION.ttlMs,
  }
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

/** Per-field validators — return an error message, or null when valid. */
export function usernameError(username: string, existing: User[]): string | null {
  const name = username.trim()
  if (name.length < 3) return 'At least 3 characters.'
  if (name.length > 20) return 'Keep it under 20 characters.'
  if (!/^[a-z0-9_]+$/i.test(name)) return 'Letters, numbers, and underscores only.'
  if (existing.some((u) => u.username.toLowerCase() === name.toLowerCase())) return 'That username is taken.'
  return null
}

export function emailError(email: string, existing: User[]): string | null {
  const value = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "That doesn't look like an email."
  if (existing.some((u) => u.email.toLowerCase() === value.toLowerCase())) return 'An account already uses this email.'
  return null
}

export function phoneError(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length < 7 || digits.length > 15) return "That doesn't look like a phone number."
  return null
}

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `At least ${PASSWORD_MIN_LENGTH} characters.`
  return null
}

/** 0–3 rough strength score for the meter. */
export function passwordStrength(password: string): number {
  let score = 0
  if (password.length >= PASSWORD_MIN_LENGTH) score++
  if (password.length >= 12) score++
  if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score++
  return score
}

export function validateSignUp(input: SignUpInput, existing: User[]): void {
  const problem =
    usernameError(input.username, existing) ??
    emailError(input.email, existing) ??
    phoneError(input.phone) ??
    passwordError(input.password)
  if (problem) throw new Error(problem)
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
  return { user, verification: newVerification(now) }
}

function assertNotExpired(verification: PendingVerification, now: number) {
  if (now > verification.expiresAt) {
    throw new Error('That code has expired — request a new one.')
  }
}

export function verifyEmail(user: User, verification: PendingVerification, code: string, now: number = Date.now()): User {
  assertNotExpired(verification, now)
  if (code.trim() !== verification.emailCode) throw new Error('That email code is not correct.')
  return { ...user, emailVerified: true }
}

export function verifyPhone(user: User, verification: PendingVerification, code: string, now: number = Date.now()): User {
  assertNotExpired(verification, now)
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
