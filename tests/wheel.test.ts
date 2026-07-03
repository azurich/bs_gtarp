import { test, expect } from 'bun:test'
import { WHEEL, WHEEL_W } from '../src/games.ts'

const RISKS = ['low', 'med', 'high'] as const

for (const risk of RISKS) {
  test(`roue ${risk} : 16 segments + 16 poids`, () => {
    expect(WHEEL[risk].length).toBe(16)
    expect(WHEEL_W[risk].length).toBe(16)
  })
  test(`roue ${risk} : poids >= 0 et somme = 1`, () => {
    WHEEL_W[risk].forEach(w => expect(w).toBeGreaterThanOrEqual(0))
    const sum = WHEEL_W[risk].reduce((s, w) => s + w, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9)
  })
  test(`roue ${risk} : EV = RTP (0.70)`, () => {
    const ev = WHEEL[risk].reduce((s, v, i) => s + v * WHEEL_W[risk][i], 0)
    expect(Math.abs(ev - 0.70)).toBeLessThan(0.001)
  })
}

test('roue low : aucun segment 0x (recup partielle)', () => {
  expect(WHEEL.low.every(v => v > 0)).toBe(true)
})
test('roue high : jackpot 50x present', () => {
  expect(WHEEL.high.includes(50)).toBe(true)
})
test('roue med : inchangee (0x / 1.5x / 2x / 5x / 15x)', () => {
  expect(WHEEL.med).toEqual([0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 2, 0, 1.5, 0, 15])
})
