let counter = 0

/** Compact unique id, stable enough for a client-side store. */
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

/** Unambiguous alphabet: no 0/O or 1/I lookalikes. */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 8-character invite code, e.g. "ABC12345". */
export function newInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)]
  }
  return code
}

export function inviteLink(code: string): string {
  return `leagueforge.app/join/${code}`
}
