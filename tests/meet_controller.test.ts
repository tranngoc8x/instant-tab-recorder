import { describe, it, expect, vi } from 'vitest'
import { MeetController, meetingKey, type MeetSession } from '../src/meet/controller'

function setup() {
    let session: MeetSession | undefined
    let recording = false
    const deps = {
        read: async () => session,
        write: async (value: MeetSession | undefined) => {
            session = value
        },
        isRecording: async () => recording,
        start: vi.fn(async () => {
            recording = true
        }),
    }
    return { controller: new MeetController(deps), deps }
}
const tab = { id: 7, url: 'https://meet.google.com/abc-defg-hij' }

describe('Meet auto recording', () => {
    it.each([
        'https://meet.google.com/abc-defg-hij',
        'https://meet.google.com/meet/abc-defg-hij?authuser=1',
        'https://meet.google.com/meet/abc-defg-hij/',
    ])('identifies the same room at %s', url => {
        expect(meetingKey(url)).toBe('/abc-defg-hij')
    })
    it('keeps the armed meeting across a redirect to the prefixed room URL', async () => {
        const { controller, deps } = setup()
        await controller.arm(tab)
        const redirected = { ...tab, url: 'https://meet.google.com/meet/abc-defg-hij?authuser=1' }
        await controller.clearForTab(tab.id, redirected.url)
        expect((await controller.update(redirected, { joined: true, title: 'Daily' })).status).toBe('recording')
        expect(deps.start).toHaveBeenCalledWith(redirected, 'Daily')
    })
    it('arms and records a prefixed room URL', async () => {
        const { controller, deps } = setup()
        const prefixed = { ...tab, url: 'https://meet.google.com/meet/abc-defg-hij?authuser=1' }
        await controller.arm(prefixed)
        expect((await controller.update(prefixed, { joined: true, title: 'Daily' })).status).toBe('recording')
        expect(deps.start).toHaveBeenCalledWith(prefixed, 'Daily')
    })
    it('waits for explicit arming then starts only after joining', async () => {
        const { controller, deps } = setup()
        expect((await controller.update(tab, { joined: true, title: 'Daily' })).status).toBe('idle')
        await controller.arm(tab)
        expect((await controller.update(tab, { joined: false, title: 'Daily' })).status).toBe('armed')
        expect(deps.start).not.toHaveBeenCalled()
        await controller.update(tab, { joined: true, title: 'Daily' })
        expect(deps.start).toHaveBeenCalledWith(tab, 'Daily')
    })
    it('serializes duplicate joined events', async () => {
        const { controller, deps } = setup()
        await controller.arm(tab)
        await Promise.all([
            controller.update(tab, { joined: true, title: 'Daily' }),
            controller.update(tab, { joined: true, title: 'Daily' }),
        ])
        expect(deps.start).toHaveBeenCalledTimes(1)
    })
    it('does not record other tabs, other meetings or forged URLs', async () => {
        const { controller, deps } = setup()
        await controller.arm(tab)
        for (const other of [
            { ...tab, id: 8 },
            { ...tab, url: 'https://meet.google.com/xyz-abcd-efg' },
            { ...tab, url: 'https://meet.google.com.evil.test/abc-defg-hij' },
        ]) {
            await controller.update(other, { joined: true, title: 'Daily' })
        }
        expect(deps.start).not.toHaveBeenCalled()
    })
    it('manual stop disarms and prevents automatic restart', async () => {
        const { controller, deps } = setup()
        await controller.arm(tab)
        await controller.clear()
        await controller.update(tab, { joined: true, title: 'Daily' })
        expect(deps.start).not.toHaveBeenCalled()
    })
    it('reports capture failure without repeated automatic attempts', async () => {
        const { controller, deps } = setup()
        deps.start.mockRejectedValue(new Error('Permission denied'))
        await controller.arm(tab)
        expect((await controller.update(tab, { joined: true, title: 'Daily' })).status).toBe('error')
        await controller.update(tab, { joined: true, title: 'Daily' })
        expect(deps.start).toHaveBeenCalledTimes(1)
    })
    it('ends the recording once the call is left, and stays stopped', async () => {
        const { controller, deps } = setup()
        await controller.arm(tab)
        await controller.update(tab, { joined: true, title: 'Daily' })
        expect((await controller.update(tab, { joined: false, title: 'Daily' })).status).toBe('recording')
        expect((await controller.update(tab, { joined: false, title: 'Daily', left: true })).status).toBe('ended')
        expect((await controller.update(tab, { joined: true, title: 'Daily' })).status).toBe('idle')
        expect(deps.start).toHaveBeenCalledTimes(1)
    })
    it('keeps recording when the recorded tab navigates off the meeting page', async () => {
        const { controller } = setup()
        await controller.arm(tab)
        await controller.update(tab, { joined: true, title: 'Daily' })
        await controller.clearForTab(7, 'https://meet.google.com/landing')
        expect((await controller.update(tab, { joined: true, title: 'Daily' })).status).toBe('recording')
    })
    it('clears waiting only for the matching tab on navigation or close', async () => {
        const { controller, deps } = setup()
        await controller.arm(tab)
        await controller.clearForTab(8)
        await controller.clearForTab(7, tab.url)
        expect((await controller.update(tab, { joined: false, title: 'Daily' })).status).toBe('armed')
        await controller.clearForTab(7, 'https://example.com')
        await controller.update(tab, { joined: true, title: 'Daily' })
        expect(deps.start).not.toHaveBeenCalled()
    })

    it('restores armed state when the worker restarts', async () => {
        const { controller, deps } = setup()
        await controller.arm(tab)
        await new MeetController(deps).update(tab, { joined: true, title: 'Daily' })
        expect(deps.start).toHaveBeenCalledTimes(1)
    })
})

describe('Microsoft Teams meetings', () => {
    it('recognizes the Teams web meeting app but not other Teams pages', () => {
        expect(meetingKey('https://teams.microsoft.com/light-meetings/launch?coords=abc')).toBe('/teams-meeting')
        expect(meetingKey('https://teams.live.com/light-meetings/launch')).toBe('/teams-meeting')
        expect(meetingKey('https://teams.microsoft.com/v2/')).toBeUndefined()
        expect(meetingKey('https://evil.example/light-meetings/launch')).toBeUndefined()
    })
    it('arms a Teams tab and starts after joining, keeping the session across in-meeting URL changes', async () => {
        const { controller, deps } = setup()
        const teams = { id: 9, url: 'https://teams.microsoft.com/light-meetings/launch?coords=abc' }
        await controller.arm(teams)
        await controller.clearForTab(9, 'https://teams.microsoft.com/light-meetings/launch?coords=xyz')
        expect((await controller.update(teams, { joined: false, title: 'Teams meeting' })).status).toBe('armed')
        await controller.update(teams, { joined: true, title: 'Sprint review' })
        expect(deps.start).toHaveBeenCalledWith(teams, 'Sprint review')
    })
})
