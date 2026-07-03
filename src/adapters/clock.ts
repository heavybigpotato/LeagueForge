/**
 * Clock provider. All timestamps in the app should come from here so a
 * server-synchronized clock (or a test clock) can replace it later.
 */
export interface Clock {
  now(): number
}

export const systemClock: Clock = { now: () => Date.now() }

let active: Clock = systemClock

export function setClock(clock: Clock) {
  active = clock
}

export function now(): number {
  return active.now()
}
