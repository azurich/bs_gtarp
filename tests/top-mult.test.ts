import { test, expect } from 'bun:test'
import { slotsIsTop, wheelIsTop, plinkoIsTop, diceIsTop, minesIsTop, PK_MULT } from '../src/games.ts'

test('slots : trois 7️⃣ (×20) = top', () => {
  expect(slotsIsTop(20)).toBe(true)
  expect(slotsIsTop(8)).toBe(false)
})
test('roue high : top segment ×50 = top', () => {
  expect(wheelIsTop('high', 50)).toBe(true)
  expect(wheelIsTop('high', 5)).toBe(false)
  expect(wheelIsTop('high', 0)).toBe(false)
})
test('plinko high : top bin = top, centre = non', () => {
  const top = Math.max(...PK_MULT.high)
  expect(plinkoIsTop('high', top)).toBe(true)
  expect(plinkoIsTop('high', PK_MULT.high[6])).toBe(false) // centre (0)
})
test('dé : gain à chance ≤ 3 = top', () => {
  expect(diceIsTop(2, true)).toBe(true)
  expect(diceIsTop(3, true)).toBe(true)
  expect(diceIsTop(50, true)).toBe(false)
  expect(diceIsTop(2, false)).toBe(false)
})
test('démineur : full-clear = top', () => {
  expect(minesIsTop(3, 22)).toBe(true)   // minesMaxGems(3)=22
  expect(minesIsTop(3, 10)).toBe(false)
  expect(minesIsTop(12, 13)).toBe(true)  // minesMaxGems(12)=13
})
