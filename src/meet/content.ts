import { meetStatusLabel } from './status'
import { readMeetState } from './detection'

const query = () => readMeetState(document, location.pathname)

// Isolated-world script; all page-derived strings remain text, never HTML.
if (/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(location.pathname)) {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;pointer-events:none'
    const root = host.attachShadow({ mode: 'closed' })
    const label = document.createElement('div')
    label.setAttribute('role', 'status')
    label.style.cssText =
        'font:13px/1.4 system-ui,sans-serif;padding:8px 12px;border-radius:8px;background:#202124;color:white;max-width:300px;box-shadow:0 2px 8px #0006'
    root.append(label)
    document.documentElement.append(host)
    let stopped = false
    let pending = false
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
        if (message?.type === 'meet-query') respond(query())
    })
    async function report() {
        if (stopped || pending) return
        pending = true
        try {
            const result = await chrome.runtime.sendMessage({ type: 'meet-state', ...query() })
            if (!result) return
            label.textContent = meetStatusLabel(result)
            label.style.background = result.status === 'recording' && !result.isPaused ? '#a50e0e' : '#202124'
        } catch {
            // Extension reload invalidates this world; ask for a page reload rather than polling forever.
            stopped = true
            clearInterval(timer)
            label.textContent = 'Meet recorder disconnected. Reload this tab to enable recording.'
        } finally {
            pending = false
        }
    }
    const timer = setInterval(() => void report(), 2000)
    void report()
    window.addEventListener(
        'pagehide',
        () => {
            stopped = true
            clearInterval(timer)
        },
        { once: true },
    )
}
