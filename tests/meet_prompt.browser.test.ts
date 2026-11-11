import { afterEach, describe, expect, it, vi } from 'vitest'
import { showRecordPrompt } from '../src/meet/prompt'

const host = document.createElement('div')
document.body.append(host)
afterEach(() => {
    vi.useRealTimers()
    host.replaceChildren()
})

const buttons = () => Array.from(host.querySelectorAll('button'))

describe('Meet record prompt', () => {
    it('selects recording when nobody answers within the timeout', () => {
        vi.useFakeTimers()
        const onChoice = vi.fn()
        showRecordPrompt(host, onChoice, 3000)
        expect(host.textContent).toContain('3s')
        vi.advanceTimersByTime(1000)
        expect(host.textContent).toContain('2s')
        vi.advanceTimersByTime(2000)
        expect(onChoice).toHaveBeenCalledExactlyOnceWith(true)
        expect(host.childElementCount).toBe(0)
    })
    it.each([
        [0, true],
        [1, false],
    ])('reports button %i as %s and ignores the later timeout', (index, expected) => {
        vi.useFakeTimers()
        const onChoice = vi.fn()
        showRecordPrompt(host, onChoice, 3000)
        buttons()[index].click()
        vi.advanceTimersByTime(5000)
        expect(onChoice).toHaveBeenCalledExactlyOnceWith(expected)
        expect(host.childElementCount).toBe(0)
    })
    it('closes without a choice when dismissed by the caller', () => {
        vi.useFakeTimers()
        const onChoice = vi.fn()
        showRecordPrompt(host, onChoice, 3000)()
        vi.advanceTimersByTime(5000)
        expect(onChoice).not.toHaveBeenCalled()
        expect(host.childElementCount).toBe(0)
    })
})
