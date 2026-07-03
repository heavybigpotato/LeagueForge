let counter = 0

/** Compact unique id, stable enough for a client-side store. */
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

import { INVITE_CODE } from './config'

/** Invite code (length/alphabet from central config), e.g. "ABC12345". */
export function newInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < INVITE_CODE.length; i++) {
    code += INVITE_CODE.alphabet[Math.floor(random() * INVITE_CODE.alphabet.length)]
  }
  return code
}

export function inviteLink(code: string): string {
  return `leagueforge.app/join/${code}`
}
