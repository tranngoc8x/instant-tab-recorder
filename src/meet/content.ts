import { readMeetingState } from './detection'

// Everyone seen in the call since joining, so people who leave early are still reported.
const seen = new Set<string>()
let joinedOnce = false
// Consecutive reads with no leave control in the DOM after joining: the call ended.
let gone = 0
function query() {
    const state = readMeetingState(document, location)
    if (state.joined) {
        joinedOnce = true
        for (const name of state.participants) seen.add(name)
    }
    gone = joinedOnce && !state.inCall ? gone + 1 : 0
    // ponytail: ~4-6s debounce (3 reads × 2s) so a re-render does not end the recording.
    return { ...state, participants: [...seen], left: gone >= 3 }
}

// No in-page UI: Chrome only starts tab capture from the extension icon, so the badge is the status.
// Same pages as meetingKey() in ./controller (manifest limits hosts). Not imported: sharing a module with the
// service worker would split it into a chunk, and content scripts cannot load ES module imports.
if (
    /^\/(?:meet\/)?[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(location.pathname) ||
    location.pathname.startsWith('/light-meetings/')
) {
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
        if (message?.type === 'meet-query') respond(readMeetingState(document, location))
    })
    let pending = false
    async function report() {
        if (pending) return
        pending = true
        try {
            await chrome.runtime.sendMessage({ type: 'meet-state', ...query() })
        } catch {
            // Extension reloaded: this world is dead, stop polling.
            clearInterval(timer)
        } finally {
            pending = false
        }
    }
    const timer = setInterval(() => void report(), 2000)
    void report()
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true })
}
