/** Time source. Injected so date-driven rules (deadlines, late, new year) are testable and demo dates are possible. */
export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });
