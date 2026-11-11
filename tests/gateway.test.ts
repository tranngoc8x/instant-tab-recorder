import { describe, expect, it, vi } from 'vitest'
import { MAX_UPLOAD_BYTES, uploadRecording } from '../src/gateway'

const accepted = () => Response.json({ job_id: 'j1', status: 'queued' }, { status: 202 })
const config = (fetchMock: typeof fetch) => ({
    url: 'https://gw.example/upload',
    token: 't',
    fetch: fetchMock,
    retryDelayMs: 0,
})

describe('JulyGateway upload', () => {
    it('posts raw audio/webm once with auth and idempotency key, returning the job id', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(accepted())
        const audio = new Blob(['audio'], { type: 'audio/webm' })
        expect(await uploadRecording(audio, config(fetchMock))).toBe('j1')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('https://gw.example/upload')
        expect(init.body).toBe(audio)
        expect(init.headers).toMatchObject({ Authorization: 'Bearer t', 'Content-Type': 'audio/webm' })
        expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('retries a lost upload with the same idempotency key', async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(new Response('busy', { status: 503 }))
            .mockResolvedValueOnce(accepted())
        expect(await uploadRecording(new Blob(['a']), config(fetchMock))).toBe('j1')
        const keys = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key'])
        expect(new Set(keys).size).toBe(1)
    })

    it('fails fast on client errors and rejects oversized audio without uploading', async () => {
        const unauthorized = vi.fn().mockResolvedValue(new Response('bad key', { status: 401 }))
        await expect(uploadRecording(new Blob(['a']), config(unauthorized))).rejects.toThrow(
            'Gateway upload failed (401): bad key',
        )
        expect(unauthorized).toHaveBeenCalledTimes(1)

        const fetchMock = vi.fn()
        await expect(uploadRecording({ size: MAX_UPLOAD_BYTES + 1 } as Blob, config(fetchMock))).rejects.toThrow(
            '25 MB',
        )
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
