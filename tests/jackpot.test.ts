import { test, expect } from 'bun:test'
import { jackpotAmount, pickJackpotMult, slotsJackpot, slotsJackpotMults, wheelMults, wheelJackpot, plinkoMults, plinkoJackpot, diceMult, WHEEL, PK_MULT } from '../src/games.ts'

test('jackpotAmount : base pool vs budget, arrondi, clamp', () => {
  expect(jackpotAmount('pool',   100000, 0.30, 0.50)).toBe(50000)  // 50% du pool
  expect(jackpotAmount('budget', 100000, 0.30, 0.50)).toBe(15000)  // 50% du budget (30k)
  expect(jackpotAmount('pool',   100000, 0.30, 0.30)).toBe(30000)  // borne basse
  expect(jackpotAmount('pool',   100000, 0.30, 0.60)).toBe(60000)  // borne haute
  expect(jackpotAmount('pool',   -5,     0.30, 0.50)).toBe(0)      // pool négatif -> 0
  expect(jackpotAmount('budget', 101,    0.30, 0.50)).toBe(15)     // round(0.30*101*0.50 = 15.15) = 15
})

test('pickJackpotMult : plus grand <= desired, sinon null', () => {
  const m = [20, 8, 3, 2, 1.75, 1.25]
  expect(pickJackpotMult(m, 45)).toBe(20)     // desired > top -> top
  expect(pickJackpotMult(m, 5)).toBe(3)       // 3 <= 5 < 8
  expect(pickJackpotMult(m, 2.5)).toBe(2)
  expect(pickJackpotMult(m, 1)).toBe(null)    // rien <= 1
})

test('slotsJackpot : brelan du bon symbole + gain', () => {
  expect(slotsJackpotMults()).toEqual([20, 8, 3, 2, 1.75, 1.25])
  const r = slotsJackpot(500, 20)
  expect(r.reels).toEqual(['7️⃣', '7️⃣', '7️⃣'])
  expect(r.mult).toBe(20)
  expect(r.gain).toBe(10000)
})

test('wheelJackpot : index porte le mult demandé', () => {
  const top = wheelMults('high')[0]                 // 50
  const w = wheelJackpot(100, 'high', top)
  expect(WHEEL.high[w.index]).toBe(top)
  expect(w.gain).toBe(Math.round(100 * top))
})

test('plinkoJackpot : bin porte le mult demandé', () => {
  const top = plinkoMults('high')[0]
  const p = plinkoJackpot(100, 'high', top)
  expect(PK_MULT.high[p.bin]).toBe(top)
  expect(p.gain).toBe(Math.round(100 * top))
})

test('diceMult = (100/chance)*RTP avec clamp', () => {
  expect(diceMult(50)).toBe(+((100 / 50) * 0.70).toFixed(2))  // 1.4
  expect(diceMult(1)).toBe(diceMult(2))                        // clamp bas (2)
  expect(diceMult(99)).toBe(diceMult(95))                      // clamp haut (95)
})
