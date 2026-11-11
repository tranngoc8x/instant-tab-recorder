export function meetStatusLabel(result: { status: string; isPaused?: boolean }): string {
    if (result.status === 'recording' && result.isPaused)
        return '⏸ Meeting recording paused. Resume from the extension controls.'
    const texts: Record<string, string> = {
        idle: 'Meet recorder: click the extension to enable recording.',
        requested: 'Recording selected but not started. Click the extension icon once to start (Chrome requires it).',
        armed: 'Meet recorder: waiting for you to join. Click the extension to cancel.',
        recording: '● Recording meeting audio. Click the extension to stop.',
        error: 'Recording could not start. Click the extension to retry.',
    }
    return texts[result.status] ?? texts.idle
}
