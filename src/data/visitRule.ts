import visitRule from './visit-rule.json'

/** A frame starts a new visit only if it comes more than this many seconds after the previous one. */
export const VISIT_GAP_SECONDS = visitRule.gapSeconds

const words: Record<number, string> = { 2: 'two', 3: 'three', 5: 'five', 10: 'ten' }

/** "five seconds", for prose. */
export const visitGapWords = `${words[VISIT_GAP_SECONDS] ?? VISIT_GAP_SECONDS} second${VISIT_GAP_SECONDS === 1 ? '' : 's'}`

/** "five-second", for "the five-second rule". */
export const visitGapAdjective = `${words[VISIT_GAP_SECONDS] ?? VISIT_GAP_SECONDS}-second`
