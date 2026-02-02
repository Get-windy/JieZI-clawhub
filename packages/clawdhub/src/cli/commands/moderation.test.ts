/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GlobalOpts } from '../types'

vi.mock('../../config.js', () => ({
  readGlobalConfig: vi.fn(async () => ({ registry: 'https://clawhub.ai', token: 'tkn' })),
}))

vi.mock('../registry.js', () => ({
  getRegistry: vi.fn(async () => 'https://clawhub.ai'),
}))

const mockApiRequest = vi.fn()
vi.mock('../../http.js', () => ({
  apiRequest: (registry: unknown, args: unknown, schema?: unknown) =>
    mockApiRequest(registry, args, schema),
}))

vi.mock('../ui.js', () => ({
  createSpinner: vi.fn(() => ({ succeed: vi.fn(), fail: vi.fn() })),
  fail: (message: string) => {
    throw new Error(message)
  },
  formatError: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  isInteractive: () => false,
  promptConfirm: vi.fn(async () => true),
}))

const { cmdBanUser } = await import('./moderation')

function makeOpts(): GlobalOpts {
  return {
    workdir: '/work',
    dir: '/work/skills',
    site: 'https://clawhub.ai',
    registry: 'https://clawhub.ai',
    registrySource: 'default',
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('cmdBanUser', () => {
  it('requires --yes when input is disabled', async () => {
    await expect(cmdBanUser(makeOpts(), 'demo', {}, false)).rejects.toThrow(/--yes/i)
  })

  it('posts handle payload', async () => {
    mockApiRequest.mockResolvedValueOnce({ ok: true, alreadyBanned: false, deletedSkills: 1 })
    await cmdBanUser(makeOpts(), 'hightower6eu', { yes: true }, false)
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/users/ban',
        body: { handle: 'hightower6eu' },
      }),
      expect.anything(),
    )
  })

  it('posts user id payload when --id is set', async () => {
    mockApiRequest.mockResolvedValueOnce({ ok: true, alreadyBanned: false, deletedSkills: 0 })
    await cmdBanUser(makeOpts(), 'user_123', { yes: true, id: true }, false)
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/users/ban',
        body: { userId: 'user_123' },
      }),
      expect.anything(),
    )
  })
})
