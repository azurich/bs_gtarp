import { test, expect } from 'bun:test'
import { bjMaxBet, BJ_BJ_MULT } from '../src/games.ts'

test('bjMaxBet = floor(budget / 2.5)', () => {
  expect(BJ_BJ_MULT).toBe(2.5)
  expect(bjMaxBet(2500)).toBe(1000)   // 2500/2.5 = 1000
  expect(bjMaxBet(0)).toBe(0)
  expect(bjMaxBet(101)).toBe(40)      // 101/2.5 = 40.4 -> 40
})
