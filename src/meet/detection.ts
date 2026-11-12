export interface MeetingState {
    joined: boolean
    inCall: boolean
    title: string
    participants: string[]
}

/** A control the user can actually click: enabled, rendered and not inside a hidden subtree. */
function isUsable(button: HTMLElement): boolean {
    if (button.matches(':disabled, [aria-disabled="true"]') || button.closest('[hidden], [aria-hidden="true"]'))
        return false
    return (
        button.getClientRects().length > 0 &&
        button.checkVisibility({ visibilityProperty: true, opacityProperty: true })
    )
}

/** Unique, whitespace-collapsed text of the matched name elements (textContent: hover-only tags still count). */
function readNames(doc: Document, selector: string): string[] {
    const names = Array.from(doc.querySelectorAll(selector), el =>
        isIcon(el) ? '' : (el.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
    )
    return [...new Set(names.filter(Boolean))]
}

/** Material icons are notranslate too and render ligature text (more_vert, devices): skip them and tile controls. */
function isIcon(el: Element): boolean {
    return (
        el.tagName === 'I' ||
        /icon/i.test(el.className) ||
        el.closest('button, [role="button"], [aria-hidden="true"]') != null
    )
}

/**
 * Read only call controls; a preview video or Join button is not a joined call.
 * `inCall`: a leave control is still in the DOM, even if a modal hides it. Its absence after joining means the call ended.
 */
export function readMeetState(doc: Document, pathname: string): MeetingState {
    const leave = Array.from(doc.querySelectorAll<HTMLElement>('button, [role="button"]')).filter(button => {
        const label = button.getAttribute('aria-label')?.trim() ?? ''
        return (
            /^(Leave call|Rời khỏi cuộc gọi|Quitter l[’']appel)$/i.test(label) ||
            Array.from(button.querySelectorAll('i, span')).some(icon => icon.textContent?.trim() === 'call_end')
        )
    })
    const title = doc.title
        .replace(/^(?:Google Meet|Meet)\s*[-–—]\s*/i, '')
        .replace(/\s*[-–—]\s*(?:Google Meet|Meet)$/i, '')
        .trim()
    return {
        joined: leave.some(isUsable),
        inCall: leave.length > 0,
        title:
            title && !/^(Google Meet|Meet)$/i.test(title)
                ? title
                : (pathname.split('/').filter(Boolean).at(-1) ?? 'Google Meet'),
        // ponytail: names of rendered video tiles only (Meet marks names notranslate); people off-screen
        // in a large call are missed unless they appear later. Read the People panel if that matters.
        participants: readNames(doc, '[data-participant-id] .notranslate'),
    }
}

/**
 * Microsoft Teams on the web: the in-call toolbar renders the Leave control as `#hangup-button`
 * (data-tid `calling-hangup-main-button`); the pre-join screen only has `prejoin-join-button`.
 */
export function readTeamsState(doc: Document): MeetingState {
    const leave = Array.from(
        doc.querySelectorAll<HTMLElement>('#hangup-button, [data-tid="calling-hangup-main-button"]'),
        el => (el.matches('button, [role="button"]') ? el : el.querySelector<HTMLElement>('button')),
    ).filter(button => button != null)
    const fromTab = doc.title.replace(/\s*\|\s*Microsoft Teams$/i, '').trim()
    const generic = /^(Microsoft Teams( meeting)?|Teams|Meeting|Cuộc họp( Microsoft Teams)?)$/i
    const fromCall = doc.querySelector('[data-tid="call-title"]')?.textContent?.trim() ?? ''
    return {
        joined: leave.some(isUsable),
        inCall: leave.length > 0,
        title: fromTab && !generic.test(fromTab) ? fromTab : fromCall || 'Teams meeting',
        // Video-stage name tags (from the live bundle); same visible-tiles ceiling as Meet.
        participants: readNames(doc, '[data-tid="participant-info-nametag"]'),
    }
}

/** Picks the reader for the meeting site the content script is running on. */
export function readMeetingState(doc: Document, location: Pick<Location, 'hostname' | 'pathname'>) {
    return location.hostname === 'meet.google.com' ? readMeetState(doc, location.pathname) : readTeamsState(doc)
}
