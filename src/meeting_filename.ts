/** Build an export name while leaving the OPFS storage identifier unchanged. */
export function meetingFilename(title: string | undefined, startAtMs: number, mainFilePath: string): string {
    const clean = (title ?? '')
        .normalize('NFC')
        .replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]/gu, '')
        .replace(/\s+/g, ' ')
        .replace(/^[.\s]+|[.\s]+$/g, '')
    const extension = mainFilePath.match(/\.[a-z0-9]+$/i)?.[0]
    if (!clean || !extension) return mainFilePath

    // Limit by UTF-8 bytes, preserving whole Unicode code points on all filesystems.
    let name = ''
    let bytes = 0
    const encoder = new TextEncoder()
    for (const character of clean) {
        const size = encoder.encode(character).length
        if (bytes + size > 160) break
        name += character
        bytes += size
    }
    // UTC and milliseconds make filenames timezone-independent and avoid same-second collisions.
    const timestamp = new Date(startAtMs).toISOString().replace('T', '_').replace(/[:.]/g, '-').replace(/Z$/, '')
    return `${name.trimEnd()}_${timestamp}${extension}`
}
