import { test, expect } from 'bun:test'
import { pickTier } from '../public/core/tiers.js'

test('perte totale → lose', () => { expect(pickTier(0, 100)).toBe('lose') })
test('mise nulle/invalide → lose', () => { expect(pickTier(50, 0)).toBe('lose') })
test('gain < mise → partial', () => { expect(pickTier(50, 100)).toBe('partial') })
test('gain = mise → push', () => { expect(pickTier(100, 100)).toBe('push') })
test('×1..×5 inclus → win', () => {
  expect(pickTier(150, 100)).toBe('win')
  expect(pickTier(500, 100)).toBe('win')   // ×5 exact
})
test('×5 < mult ≤ ×10 → big-win', () => {
  expect(pickTier(501, 100)).toBe('big-win')
  expect(pickTier(1000, 100)).toBe('big-win')  // ×10 exact
})
test('mult > ×10 sans top → mega-win', () => {
  expect(pickTier(1500, 100)).toBe('mega-win')
  expect(pickTier(2000, 100)).toBe('mega-win')
})
test('top + mult ≥ ×10 → jackpot', () => {
  expect(pickTier(2000, 100, true)).toBe('jackpot')  // ×20 top
})
test('jackpot prime sur mega', () => {
  expect(pickTier(5000, 100, true)).toBe('jackpot')  // ×50 top
})
test('top mais mult < gate → pas jackpot (win)', () => {
  expect(pickTier(250, 100, true)).toBe('win')   // ×2.5 top (blackjack)
})
test('isTop absent (défaut) → jamais jackpot', () => {
  expect(pickTier(2000, 100)).toBe('mega-win')
})
