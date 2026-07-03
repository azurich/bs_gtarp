import { test, expect, afterEach } from 'bun:test'
import { verifyTurnstile } from '../turnstile'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

function mockFetch(impl: (url: unknown, init: any) => unknown) {
  globalThis.fetch = impl as unknown as typeof fetch
}

test('token vide → false sans appel réseau', async () => {
  let called = false
  mockFetch(() => { called = true; return {} })
  expect(await verifyTurnstile('secret', '')).toBe(false)
  expect(called).toBe(false)
})

test('success:true → true', async () => {
  mockFetch(async () => ({ ok: true, json: async () => ({ success: true }) }))
  expect(await verifyTurnstile('secret', 'tok', '1.2.3.4')).toBe(true)
})

test('success:false → false', async () => {
  mockFetch(async () => ({ ok: true, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) }))
  expect(await verifyTurnstile('secret', 'tok')).toBe(false)
})

test('erreur réseau → false (fail-closed)', async () => {
  mockFetch(async () => { throw new Error('network down') })
  expect(await verifyTurnstile('secret', 'tok')).toBe(false)
})

test('réponse HTTP non-ok → false', async () => {
  mockFetch(async () => ({ ok: false, json: async () => ({}) }))
  expect(await verifyTurnstile('secret', 'tok')).toBe(false)
})

test('envoie secret + response + remoteip en form-urlencoded', async () => {
  let captured: any = null
  mockFetch(async (_url: unknown, init: any) => {
    captured = init
    return { ok: true, json: async () => ({ success: true }) }
  })
  await verifyTurnstile('sek', 'tok', '9.9.9.9')
  const body = captured.body as URLSearchParams
  expect(body.get('secret')).toBe('sek')
  expect(body.get('response')).toBe('tok')
  expect(body.get('remoteip')).toBe('9.9.9.9')
})
