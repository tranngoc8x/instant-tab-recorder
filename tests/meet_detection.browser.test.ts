import { afterEach, describe, expect, it } from 'vitest'
import { readMeetState } from '../src/meet/detection'

const fixture = document.createElement('div')
document.body.append(fixture)
afterEach(() => {
    fixture.replaceChildren()
    document.title = ''
})

function state() {
    return readMeetState(document, '/abc-defg-hij')
}

describe('Google Meet detection', () => {
    it('does not treat the preview or join button as an active call', () => {
        fixture.innerHTML = '<button>Join now</button><video></video>'
        expect(state().joined).toBe(false)
    })
    it.each(['Leave call', 'Rời khỏi cuộc gọi', 'Quitter l’appel'])('recognizes the visible %s control', label => {
        fixture.innerHTML = `<button aria-label="${label}">Hang up</button>`
        expect(state().joined).toBe(true)
    })
    it('recognizes the language-independent call_end icon inside a button', () => {
        fixture.innerHTML = '<button aria-label="Beenden"><i>call_end</i></button>'
        expect(state().joined).toBe(true)
    })
    it('ignores a call_end string outside a control', () => {
        fixture.innerHTML = '<p>call_end</p>'
        expect(state().joined).toBe(false)
    })
    it.each(['hidden', 'style="display:none"', 'style="visibility:hidden"', 'disabled', 'aria-disabled="true"'])(
        'ignores unavailable leave controls: %s',
        attribute => {
            fixture.innerHTML = `<button aria-label="Leave call" ${attribute}></button>`
            expect(state().joined).toBe(false)
        },
    )
    it('ignores leave controls in a hidden ancestor', () => {
        fixture.innerHTML = '<div hidden><button aria-label="Leave call"></button></div>'
        expect(state().joined).toBe(false)
    })
    it.each(['Meet - Sprint planning', 'Sprint planning - Google Meet', 'Google Meet – Sprint planning'])(
        'extracts meeting name from %s',
        title => {
            document.title = title
            expect(state().title).toBe('Sprint planning')
        },
    )
    it('preserves a real title containing Meet', () => {
        document.title = 'Meet the team'
        expect(state().title).toBe('Meet the team')
    })
    it('falls back to the meeting code for a generic title', () => {
        document.title = 'Google Meet'
        expect(state().title).toBe('abc-defg-hij')
    })
})
