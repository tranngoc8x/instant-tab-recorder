import { describe, expect, it } from 'vitest'
import { meetStatusLabel } from '../src/meet/status'

describe('Meet recording indicator', () => {
    it('distinguishes paused from actively recording', () => {
        expect(meetStatusLabel({ status: 'recording', isPaused: true })).toContain('paused')
        expect(meetStatusLabel({ status: 'recording', isPaused: false })).toContain('Recording meeting audio')
    })
    it('explains waiting and capture errors', () => {
        expect(meetStatusLabel({ status: 'armed' })).toContain('waiting')
        expect(meetStatusLabel({ status: 'error' })).toContain('retry')
        expect(meetStatusLabel({ status: 'requested' })).toContain('Click the extension icon once')
    })
})
