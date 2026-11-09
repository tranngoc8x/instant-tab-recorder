import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendEvent, sendException, flush } from '../src/telemetry'

describe('local telemetry', () => {
    afterEach(() => vi.restoreAllMocks())

    it('logs model download events locally without network requests', async () => {
        const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        const event = { type: 'model_download_complete' as const, metrics: { totalMs: 12500 } }
        sendEvent(event)
        await flush()
        expect(debug).toHaveBeenCalledWith('event:', event)
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('logs exceptions locally', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const exception = new Error('test')
        sendException(exception, { exceptionSource: 'test' })
        expect(error).toHaveBeenCalledWith('exception [test]:', exception, {})
    })
})
