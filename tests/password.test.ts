import { test, expect } from 'bun:test'
import { checkPassword, errorMessage, MIN_LEN } from '../public/core/password.js'

test('trop court → length faux, ok faux', () => {
  const r = checkPassword('Ab1!', 'joueur')
  expect(r.rules.length).toBe(false)
  expect(r.ok).toBe(false)
})
test('manque majuscule', () => {
  const r = checkPassword('str0ng!passw', 'joueur')
  expect(r.rules.upper).toBe(false); expect(r.ok).toBe(false)
})
test('manque minuscule', () => {
  const r = checkPassword('STR0NG!PASSW', 'joueur')
  expect(r.rules.lower).toBe(false); expect(r.ok).toBe(false)
})
test('manque chiffre', () => {
  const r = checkPassword('Strong!Passwd', 'joueur')
  expect(r.rules.digit).toBe(false); expect(r.ok).toBe(false)
})
test('manque caractère spécial', () => {
  const r = checkPassword('Str0ngPasswd1', 'joueur')
  expect(r.rules.special).toBe(false); expect(r.ok).toBe(false)
})
test('contient le pseudo → notName faux, ok faux', () => {
  const r = checkPassword('Motdepasse1!', 'motdepasse')
  expect(r.rules.notName).toBe(false); expect(r.ok).toBe(false)
})
test('pseudo court (<3) → notName vrai (pas de fausse alarme)', () => {
  const r = checkPassword('Str0ng!Passw', 'ab')
  expect(r.rules.notName).toBe(true)
})
test('valide minimal (12 car, 4 classes) → ok, label Moyen, score 5', () => {
  const r = checkPassword('Str0ng!Passw', 'joueur')
  expect(r.ok).toBe(true); expect(r.label).toBe('Moyen'); expect(r.score).toBe(5)
})
test('long (≥16 car, 4 classes) → label Fort, score 6', () => {
  const r = checkPassword('Str0ng!Password!', 'joueur')
  expect(r.label).toBe('Fort'); expect(r.score).toBe(6)
})
test('errorMessage : 1re règle manquante, null si ok', () => {
  expect(errorMessage(checkPassword('Ab1!', 'joueur'))).toContain('caractères')
  expect(errorMessage(checkPassword('Str0ng!Passw', 'joueur'))).toBe(null)
})
test('MIN_LEN = 12', () => { expect(MIN_LEN).toBe(12) })
