import { test, expect } from 'bun:test'
import { bjMaxBet, minesStepFactor, BJ_BJ_MULT, MINES_RAKE } from '../src/games.ts'

test('bjMaxBet = floor(budget / 2.2)', () => {
  expect(BJ_BJ_MULT).toBe(2.2)
  expect(bjMaxBet(2200)).toBe(1000)
  expect(bjMaxBet(0)).toBe(0)
  expect(bjMaxBet(100)).toBe(45)      // 100/2.2 = 45.45 -> 45
})

test('minesStepFactor — 1re case (3 bombes) = (25/22)*(1-rake)', () => {
  expect(MINES_RAKE).toBe(0.11)
  const f = minesStepFactor(0, 3)     // (25/22) * 0.89
  expect(f).toBeCloseTo((25 / 22) * 0.89, 6)
  expect(f).toBeGreaterThan(1)        // 1er pas paie (>1)
})

test('minesStepFactor croît avec les picks (cases sûres plus rares)', () => {
  expect(minesStepFactor(5, 3)).toBeGreaterThan(minesStepFactor(0, 3))
})
