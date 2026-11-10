/** Read only call controls; a preview video or Join button is not a joined call. */
export function readMeetState(doc: Document, pathname: string): { joined: boolean; title: string } {
    const joined = Array.from(doc.querySelectorAll<HTMLElement>('button, [role="button"]')).some(button => {
        if (button.matches(':disabled, [aria-disabled="true"]') || button.closest('[hidden], [aria-hidden="true"]'))
            return false
        if (
            !button.getClientRects().length ||
            !button.checkVisibility({ visibilityProperty: true, opacityProperty: true })
        )
            return false
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
