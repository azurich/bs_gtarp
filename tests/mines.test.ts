import { test, expect } from 'bun:test'
import {
  minesMult, minesSafeProb, minesMaxGems, minesDisplayBombs,
  MINES_RTP,
} from '../src/games.ts'

test('minesMult = m1 * g^(gems-1)', () => {
  expect(minesMult(3, 0)).toBe(1)
  expect(minesMult(3, 1)).toBeCloseTo(1.15, 9)
  expect(minesMult(3, 2)).toBeCloseTo(1.15 * 1.25, 9)
  expect(minesMult(6, 1)).toBeCloseTo(1.5, 9)
  expect(minesMult(12, 3)).toBeCloseTo(3 * 2.5 * 2.5, 9)
})

test('minesSafeProb : le 1er clic porte l edge (0.70/m1), ensuite 1/g', () => {
  expect(minesSafeProb(3, 1)).toBeCloseTo(MINES_RTP / 1.15, 9)
  expect(minesSafeProb(3, 2)).toBeCloseTo(1 / 1.25, 9)
  expect(minesSafeProb(12, 1)).toBeCloseTo(MINES_RTP / 3, 9)
  expect(minesSafeProb(12, 5)).toBeCloseTo(1 / 2.5, 9)
})

test('minesMaxGems = 25 - bombs', () => {
  expect(minesMaxGems(3)).toBe(22)
  expect(minesMaxGems(6)).toBe(19)
  expect(minesMaxGems(12)).toBe(13)
})

test('minesDisplayBombs : bon compte, inclut la fatale, exclut les gemmes', () => {
  const gems = [0, 1, 2]
  const b = minesDisplayBombs(gems, 6, 7)
  expect(b.length).toBe(6)
  expect(b).toContain(7)                       // case fatale
  expect(b.every(i => !gems.includes(i))).toBe(true)
  expect(new Set(b).size).toBe(6)              // pas de doublon
  // sweep : fatal = -1
  const sweep = minesDisplayBombs([...Array(22).keys()], 3, -1)
  expect(sweep.length).toBe(3)
})

// Simulation : RTP = 0.70 quelle que soit la politique d'encaissement (budget illimité).
function simRTP(bombs: number, stopAt: number, n: number): number {
  const maxG = minesMaxGems(bombs)
  let wagered = 0, paid = 0
  for (let k = 0; k < n; k++) {
    wagered += 1
    let gems = 0, alive = true
    while (alive && gems < maxG) {
      if (gems >= stopAt) break                // encaisse dès qu'on atteint stopAt gemmes
      if (Math.random() < minesSafeProb(bombs, gems + 1)) gems++
      else alive = false
    }
    if (alive) paid += minesMult(bombs, gems)  // encaissé (ou sweep) ; bombe -> 0
  }
  return paid / wagered
}

test('RTP ~= 0.70 pour 3/6/12 bombes, toutes politiques (budget illimite)', () => {
  const N = 200_000
  for (const bombs of [3, 6, 12]) {
    for (const stop of [1, 2, 3]) {
      const rtp = simRTP(bombs, stop, N)
      expect(rtp).toBeGreaterThan(0.665)
      expect(rtp).toBeLessThan(0.735)
    }
  }
})
