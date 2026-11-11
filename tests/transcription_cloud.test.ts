import { describe, expect, it, vi } from 'vitest'
import { CLOUD_TRANSCRIPTION_URL, MAX_UPLOAD_BYTES, toSegments, transcribeViaApi } from '../src/transcription/cloud'

describe('cloud transcription', () => {
    it('maps verbose_json segments and drops empty or invalid ones', () => {
        expect(
            toSegments({
                segments: [
                    { start: 0, end: 2.34567, text: '  Xin chào\u0007 ' },
                    { start: 3, end: 2, text: 'end before start' },
                    { start: 4, end: 5, text: '   ' },
                    { start: 'x', end: 6, text: 'bad start' },
                ],
            }),
        ).toEqual([
            { startSec: 0, endSec: 2.346, text: 'Xin chào' },
            { startSec: 3, endSec: 3, text: 'end before start' },
        ])
        expect(() => toSegments({ text: 'no segments' })).toThrow('no segments')
    })

    it('posts the audio as multipart with the bearer key', async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ segments: [{ start: 0, end: 1, text: 'a' }] }))
        const segments = await transcribeViaApi(new Blob(['audio']), { apiKey: 'k', language: 'vi', fetch: fetchMock })
        expect(segments).toEqual([{ startSec: 0, endSec: 1, text: 'a' }])
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(CLOUD_TRANSCRIPTION_URL)
        expect(init.headers).toEqual({ Authorization: 'Bearer k' })
        const form = init.body as FormData
        expect(form.get('model')).toBe('groq/whisper-large-v3-turbo')
        expect(form.get('language')).toBe('vi')
        expect(form.get('response_format')).toBe('verbose_json')
        expect((form.get('file') as File).name).toBe('meeting.webm')
    })

    it('fails on HTTP errors and oversized audio without uploading', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('invalid key', { status: 401 }))
        await expect(
            transcribeViaApi(new Blob(['a']), { apiKey: 'k', language: 'vi', fetch: fetchMock }),
        ).rejects.toThrow('Transcription API 401: invalid key')
        fetchMock.mockClear()
        const huge = { size: MAX_UPLOAD_BYTES + 1 } as Blob
        await expect(transcribeViaApi(huge, { apiKey: 'k', language: 'vi', fetch: fetchMock })).rejects.toThrow('25 MB')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
