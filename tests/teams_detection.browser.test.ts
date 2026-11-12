import { afterEach, describe, expect, it } from 'vitest'
import { readMeetingState, readTeamsState } from '../src/meet/detection'

const fixture = document.createElement('div')
document.body.append(fixture)
afterEach(() => {
    fixture.replaceChildren()
    document.title = ''
})

describe('Microsoft Teams detection', () => {
    it('does not treat the pre-join screen as a joined call', () => {
        fixture.innerHTML = '<button data-tid="prejoin-join-button">Join now</button>'
        expect(readTeamsState(document).joined).toBe(false)
    })
    it.each([
        '<button id="hangup-button" title="Leave">Leave</button>',
        '<div id="hangup-button"><button title="Leave">Leave</button></div>',
        '<button data-tid="calling-hangup-main-button">Leave</button>',
    ])('recognizes the in-call Leave control: %s', html => {
        fixture.innerHTML = html
        expect(readTeamsState(document).joined).toBe(true)
    })
    it.each(['disabled', 'hidden', 'style="display:none"'])('ignores an unusable Leave control: %s', attribute => {
        fixture.innerHTML = `<button id="hangup-button" ${attribute}>Leave</button>`
        expect(readTeamsState(document).joined).toBe(false)
    })
    it('takes the meeting name from the tab title, then the call title, then a default', () => {
        document.title = 'Sprint review | Microsoft Teams'
        expect(readTeamsState(document).title).toBe('Sprint review')
        document.title = 'Microsoft Teams meeting | Microsoft Teams'
        fixture.innerHTML = '<p data-tid="call-title">Weekly sync</p>'
        expect(readTeamsState(document).title).toBe('Weekly sync')
        fixture.replaceChildren()
        expect(readTeamsState(document).title).toBe('Teams meeting')
    })
    it('dispatches by site', () => {
        document.title = 'Daily - Google Meet'
        fixture.innerHTML = '<button id="hangup-button">Leave</button>'
        expect(readMeetingState(document, { hostname: 'meet.google.com', pathname: '/abc-defg-hij' })).toEqual({
            joined: false,
            title: 'Daily',
        })
        expect(
            readMeetingState(document, { hostname: 'teams.microsoft.com', pathname: '/light-meetings/launch' }).joined,
        ).toBe(true)
    })
})
