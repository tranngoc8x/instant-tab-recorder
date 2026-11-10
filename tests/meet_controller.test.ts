import { describe, it, expect, vi } from 'vitest'
import { MeetController, type MeetSession } from '../src/meet/controller'

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
