import { describe, expect, it, vi } from 'vitest'
import { CHAT_COMPLETIONS_URL, summarizeViaApi } from '../src/summary/cloud'

const reply = (content: unknown) => Response.json({ choices: [{ message: { content } }] })

describe('cloud summary', () => {
    it('posts one user message to the chat model and strips reasoning', async () => {
        const fetchMock = vi.fn().mockResolvedValue(reply('<think>plan</think>\n## Tổng quan\nOK'))
        const text = await summarizeViaApi('prompt', { apiKey: 'k', model: 'm', fetch: fetchMock })
        expect(text).toBe('## Tổng quan\nOK')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(CHAT_COMPLETIONS_URL)
        expect(init.headers.Authorization).toBe('Bearer k')
        expect(JSON.parse(init.body)).toEqual({ model: 'm', messages: [{ role: 'user', content: 'prompt' }] })
    })

    it('fails on HTTP errors and empty answers', async () => {
        const opts = { apiKey: 'k', model: 'm' }
        await expect(
            summarizeViaApi('p', { ...opts, fetch: vi.fn().mockResolvedValue(new Response('quota', { status: 429 })) }),
        ).rejects.toThrow('Chat API 429: quota')
        await expect(summarizeViaApi('p', { ...opts, fetch: vi.fn().mockResolvedValue(reply('  ')) })).rejects.toThrow(
            'empty',
        )
    })
})
