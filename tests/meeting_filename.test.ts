import { meetingFilename } from '../src/meeting_filename'

describe('meetingFilename', () => {
    const timestamp = Date.UTC(2026, 10, 10, 7, 30, 1, 123)
    const suffix = '_2026-11-10_07-30-01-123.webm'

    it('preserves Vietnamese and appends the recording timestamp and original extension', () => {
        expect(meetingFilename('  Họp nhóm kỹ thuật  ', timestamp, 'video-1.webm')).toBe(`Họp nhóm kỹ thuật${suffix}`)
        expect(meetingFilename('Planning', timestamp, 'video-1.mp3')).toBe('Planning_2026-11-10_07-30-01-123.mp3')
    })

    it('removes reserved filename characters and controls', () => {
        expect(meetingFilename(' .Sprint / Review:*?"<>|\\\u0000\u202e. ', timestamp, 'video-1.webm')).toBe(
            `Sprint Review${suffix}`,
        )
    })

    it('falls back to the internal filename if the meeting has no usable title', () => {
        for (const title of [undefined, '', '   ', '... /:*?']) {
            expect(meetingFilename(title, timestamp, 'video-1.webm')).toBe('video-1.webm')
        }
    })

    it('bounds the UTF-8 filename length without splitting Unicode characters', () => {
        const name = meetingFilename('😀'.repeat(100), timestamp, 'video-1.webm')
        expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(200)
        expect(name).not.toContain('\ufffd')
        expect(name).toBe(`${'😀'.repeat(40)}${suffix}`)
    })

    it('differentiates repeated titles recorded within the same second', () => {
        expect(meetingFilename('Daily', timestamp, 'video-1.webm')).not.toBe(
            meetingFilename('Daily', timestamp + 1, 'video-2.webm'),
        )
    })
})
