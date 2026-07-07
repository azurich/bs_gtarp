import { test, expect } from 'bun:test'
import { jackpotAmount } from '../src/games.ts'

test('jackpotAmount : base pool vs budget, arrondi, clamp', () => {
  expect(jackpotAmount('pool',   100000, 0.30, 0.50)).toBe(50000)  // 50% du pool
  expect(jackpotAmount('budget', 100000, 0.30, 0.50)).toBe(15000)  // 50% du budget (30k)
  expect(jackpotAmount('pool',   100000, 0.30, 0.30)).toBe(30000)  // borne basse
  expect(jackpotAmount('pool',   100000, 0.30, 0.60)).toBe(60000)  // borne haute
  expect(jackpotAmount('pool',   -5,     0.30, 0.50)).toBe(0)      // pool négatif -> 0
  expect(jackpotAmount('budget', 101,    0.30, 0.50)).toBe(15)     // round(0.30*101*0.50 = 15.15) = 15
})
