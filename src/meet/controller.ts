export type MeetTab = Pick<chrome.tabs.Tab, 'id' | 'url'>
export interface MeetSession {
    tabId: number
    meeting: string
    status: 'armed' | 'recording' | 'error'
    error?: string
}
export interface MeetState {
    joined: boolean
    title: string
    /** Names seen in the call so far (content script keeps the union). */
    participants?: string[]
    /** Was in the call and the leave control has been gone for a while: the meeting ended. */
    left?: boolean
}
interface Deps {
    read(): Promise<MeetSession | undefined>
    write(value: MeetSession | undefined): Promise<void>
    isRecording(): Promise<boolean>
    start(tab: MeetTab, title: string): Promise<void>
}

const TEAMS_ORIGINS = ['https://teams.microsoft.com', 'https://teams.live.com']

/**
 * Identifies a supported meeting page: a Google Meet room, or the Teams web meeting app (`/light-meetings/`,
 * reached from meeting links). Teams keeps one path for every meeting, so its key is per tab, not per meeting.
 */
export function meetingKey(url?: string): string | undefined {
    try {
        const parsed = new URL(url ?? '')
        const meetRoom = /^\/(?:meet\/)?([a-z]{3}-[a-z]{4}-[a-z]{3})\/?$/.exec(parsed.pathname)
        if (parsed.origin === 'https://meet.google.com' && meetRoom) {
            return `/${meetRoom[1]}`
        }
        if (TEAMS_ORIGINS.includes(parsed.origin) && parsed.pathname.startsWith('/light-meetings/')) {
            return '/teams-meeting'
        }
    } catch {
        /* Not a meeting URL. */
    }
}

/** Serializes starts and persists permission intent across service worker suspension. */
export class MeetController {
    private pending: Promise<unknown> = Promise.resolve()
    constructor(private readonly deps: Deps) {}

    private serialize<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.pending.then(operation)
        this.pending = result.catch(() => {})
        return result
    }

    arm(tab: MeetTab): Promise<void> {
        return this.serialize(async () => {
            const meeting = meetingKey(tab.url)
            if (tab.id == null || !meeting) throw new Error('Open a Google Meet or Microsoft Teams meeting first.')
            if (await this.deps.isRecording()) throw new Error('A recording is already running.')
            await this.deps.write({ tabId: tab.id, meeting, status: 'armed' })
        })
    }

    clear(): Promise<void> {
        return this.serialize(() => this.deps.write(undefined))
    }

    clearForTab(tabId: number, nextUrl?: string): Promise<void> {
        return this.serialize(async () => {
            const session = await this.deps.read()
            if (session?.tabId !== tabId) return
            // Navigating never stops a recording; only closing the tab (tab-track-ended) or leaving the call does.
            if (nextUrl !== undefined && (session.status === 'recording' || session.meeting === meetingKey(nextUrl)))
                return
            await this.deps.write(undefined)
        })
    }

    update(
        tab: MeetTab,
        state: MeetState,
    ): Promise<{ status: 'idle' | 'armed' | 'recording' | 'error' | 'ended'; error?: string }> {
        return this.serialize(async () => {
            const session = await this.deps.read()
            if (!session || session.tabId !== tab.id || session.meeting !== meetingKey(tab.url))
                return { status: 'idle' }
            if (session.status === 'recording' && !(await this.deps.isRecording())) {
                await this.deps.write(undefined)
                return { status: 'idle' }
            }
            if (session.status === 'recording' && state.left) {
                await this.deps.write(undefined)
                return { status: 'ended' }
            }
            if (session.status !== 'armed' || !state.joined) return session
            if (await this.deps.isRecording()) return { status: 'armed' }
            try {
                await this.deps.start(tab, state.title.trim().slice(0, 200) || session.meeting.slice(1))
                session.status = 'recording'
            } catch {
                session.status = 'error'
                session.error = 'Could not start recording. Click the extension to try again.'
            }
            await this.deps.write(session)
            return session
        })
    }
}
