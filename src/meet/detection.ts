/** A control the user can actually click: enabled, rendered and not inside a hidden subtree. */
function isUsable(button: HTMLElement): boolean {
    if (button.matches(':disabled, [aria-disabled="true"]') || button.closest('[hidden], [aria-hidden="true"]'))
        return false
    return (
        button.getClientRects().length > 0 &&
        button.checkVisibility({ visibilityProperty: true, opacityProperty: true })
    )
}

/** Read only call controls; a preview video or Join button is not a joined call. */
export function readMeetState(doc: Document, pathname: string): { joined: boolean; title: string } {
    const joined = Array.from(doc.querySelectorAll<HTMLElement>('button, [role="button"]')).some(button => {
        if (!isUsable(button)) return false
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
        joined,
        title:
            title && !/^(Google Meet|Meet)$/i.test(title)
                ? title
                : (pathname.split('/').filter(Boolean)[0] ?? 'Google Meet'),
    }
}

/**
 * Microsoft Teams on the web: the in-call toolbar renders the Leave control as `#hangup-button`
 * (data-tid `calling-hangup-main-button`); the pre-join screen only has `prejoin-join-button`.
 */
export function readTeamsState(doc: Document): { joined: boolean; title: string } {
    const joined = Array.from(
        doc.querySelectorAll<HTMLElement>('#hangup-button, [data-tid="calling-hangup-main-button"]'),
    ).some(el => {
        const button = el.matches('button, [role="button"]') ? el : el.querySelector<HTMLElement>('button')
        return button != null && isUsable(button)
    })
    const fromTab = doc.title.replace(/\s*\|\s*Microsoft Teams$/i, '').trim()
    const generic = /^(Microsoft Teams( meeting)?|Teams|Meeting|Cuộc họp( Microsoft Teams)?)$/i
    const fromCall = doc.querySelector('[data-tid="call-title"]')?.textContent?.trim() ?? ''
    return {
        joined,
        title: fromTab && !generic.test(fromTab) ? fromTab : fromCall || 'Teams meeting',
    }
}

/** Picks the reader for the meeting site the content script is running on. */
export function readMeetingState(doc: Document, location: Pick<Location, 'hostname' | 'pathname'>) {
    return location.hostname === 'meet.google.com' ? readMeetState(doc, location.pathname) : readTeamsState(doc)
}
