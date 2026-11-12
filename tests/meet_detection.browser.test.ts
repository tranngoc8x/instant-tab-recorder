import { afterEach, describe, expect, it } from 'vitest'
import { readMeetState, readTeamsState } from '../src/meet/detection'

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
    it('keeps inCall while a modal hides the leave control, and drops it once the control is gone', () => {
        fixture.innerHTML = '<div aria-hidden="true"><button aria-label="Leave call"></button></div>'
        expect(state()).toMatchObject({ joined: false, inCall: true })
        fixture.innerHTML = '<button>Rejoin</button>'
        expect(state().inCall).toBe(false)
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
    it('uses the room code instead of the meet prefix when the title is generic', () => {
        document.title = 'Google Meet'
        expect(readMeetState(document, '/meet/abc-defg-hij/').title).toBe('abc-defg-hij')
    })
})

describe('participant names', () => {
    it('reads unique Meet tile names, ignoring text outside tiles', () => {
        fixture.innerHTML = `
            <div data-participant-id="a"><span class="notranslate">Lan  Nguyễn</span></div>
            <div data-participant-id="b"><div class="notranslate"><span class="notranslate">Minh</span></div></div>
            <div data-participant-id="c"><span class="notranslate">Lan Nguyễn</span></div>
            <span class="notranslate">Not a participant</span>`
        expect(state().participants).toEqual(['Lan Nguyễn', 'Minh'])
    })
    it('skips Material icon ligatures and tile controls inside Meet tiles', () => {
        fixture.innerHTML = `
            <div data-participant-id="a">
                <i class="google-material-icons notranslate">frame_person</i>
                <span class="material-icons-extended notranslate">devices</span>
                <div aria-hidden="true"><span class="notranslate">visual_effects</span></div>
                <button><span class="notranslate">more_vert</span></button>
                <span class="notranslate">Thắng Trần</span>
                <span class="notranslate"></span>
            </div>`
        expect(state().participants).toEqual(['Thắng Trần'])
    })
    it('reads Teams name tags even when hidden until hover', () => {
        fixture.innerHTML = `
            <div data-tid="participant-info-nametag">Lan</div>
            <div data-tid="participant-info-nametag" style="display:none">Minh</div>`
        expect(readTeamsState(document).participants).toEqual(['Lan', 'Minh'])
    })
})
