import type { User } from './types'
import { newId } from './ids'
import { PASSWORD_MIN_LENGTH } from './config'

/**
 * Account creation and identity. LeagueForge has no fake pre-loaded users:
 * every account is created through this flow. Accounts are real records —
 * username, email, optional phone — with nothing simulated on top.
 */

export interface SignUpInput {
  username: string
  email: string
  /** Optional — shown to teammates for match-day coordination. */
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

/** Phone is optional — empty is fine, but a filled-in one must look real. */
export function phoneError(phone: string): string | null {
  if (phone.trim() === '') return null
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

export function createAccount(input: SignUpInput, existing: User[], now: number = Date.now()): User {
  validateSignUp(input, existing)
  const passwordSalt = newId('salt') + Math.random().toString(36).slice(2)
  return {
    id: newId('user'),
    username: input.username.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    passwordHash: hashPassword(input.password, passwordSalt),
    passwordSalt,
    deviceFingerprint: deviceFingerprint(),
    reputation: 100,
    createdAt: now,
  }
}

function deviceFingerprint(): string {
  try {
    return `fp_${(navigator.userAgent.length * 31 + screen.width * 7 + screen.height).toString(36)}`
  } catch {
    return `fp_${newId('dev')}`
  }
}
