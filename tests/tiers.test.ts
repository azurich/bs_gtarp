import { test, expect } from 'bun:test'
import { pickTier } from '../public/core/tiers.js'

test('perte totale → lose', () => {
  expect(pickTier(0, 100)).toBe('lose')
})
test('mise nulle ou invalide → lose', () => {
  expect(pickTier(50, 0)).toBe('lose')
})
test('récupération partielle (gain < mise) → partial', () => {
  expect(pickTier(50, 100)).toBe('partial')
})
test('mise rendue (gain == mise) → push', () => {
  expect(pickTier(100, 100)).toBe('push')
})
test('petit gain net jusqu\'à x2 inclus → win-s', () => {
  expect(pickTier(150, 100)).toBe('win-s')
  expect(pickTier(200, 100)).toBe('win-s')
})
test('gain moyen >x2 jusqu\'à x5 inclus → win-m', () => {
  expect(pickTier(201, 100)).toBe('win-m')
  expect(pickTier(500, 100)).toBe('win-m')
})
test('gros gain >x5 jusqu\'à x20 inclus → win-big', () => {
  expect(pickTier(501, 100)).toBe('win-big')
  expect(pickTier(2000, 100)).toBe('win-big')
})
test('jackpot >x20 → win-mega', () => {
  expect(pickTier(2001, 100)).toBe('win-mega')
})
