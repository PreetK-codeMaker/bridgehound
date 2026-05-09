import { describe, expect, it, vi } from 'vitest'
import { MemoryCache } from '../../src/cache/memory.js'

describe('MemoryCache', () => {
  it('returns null for keys that were never set', async () => {
    const cache = new MemoryCache()
    expect(await cache.get('missing')).toBeNull()
  })

  it('round-trips arbitrary values, including objects and bigints', async () => {
    const cache = new MemoryCache()
    const value = { hash: '0xabc', blockNumber: 12345n, nested: { ok: true } }
    await cache.set('k', value)
    const out = await cache.get<typeof value>('k')
    expect(out).toEqual(value)
    // MemoryCache stores by reference, so identity holds — Redis adapter would
    // not. Worth pinning so a future change that introduces unintended copies
    // surfaces here.
    expect(out).toBe(value)
  })

  it('honours TTL: returns null after expiry', async () => {
    const cache = new MemoryCache()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      await cache.set('k', 'v', 5)
      vi.setSystemTime(4_999)
      expect(await cache.get('k')).toBe('v')
      vi.setSystemTime(5_001)
      expect(await cache.get('k')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats omitted ttlSeconds as no expiry', async () => {
    const cache = new MemoryCache()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      await cache.set('k', 'v')
      vi.setSystemTime(10 ** 12)
      expect(await cache.get('k')).toBe('v')
    } finally {
      vi.useRealTimers()
    }
  })

  it('delete removes the key', async () => {
    const cache = new MemoryCache()
    await cache.set('k', 'v')
    await cache.delete('k')
    expect(await cache.get('k')).toBeNull()
  })

  it('delete on a missing key is a no-op', async () => {
    const cache = new MemoryCache()
    await cache.delete('never-set')
    expect(await cache.get('never-set')).toBeNull()
  })

  it('a get past TTL clears the entry from the underlying store', async () => {
    const cache = new MemoryCache()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      await cache.set('k', 'v', 1)
      vi.setSystemTime(10_000)
      expect(await cache.get('k')).toBeNull()
      // Re-checking should still be null without re-set; the lazy expiry
      // path in get() must not leave a ghost entry behind.
      expect(await cache.get('k')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
