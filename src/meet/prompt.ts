/**
 * Asks once per meeting page whether to record; no answer within `ms` counts as yes.
 * A page click cannot start tab capture (Chrome requires invoking the extension), so "yes"
 * only records intent and the banner then asks for one extension click.
 */
export function showRecordPrompt(parent: Node, onChoice: (record: boolean) => void, ms = 3000): () => void {
    const box = document.createElement('div')
    box.setAttribute('role', 'dialog')
    box.style.cssText =
        'pointer-events:auto;margin-top:8px;font:13px/1.4 system-ui,sans-serif;padding:10px 12px;border-radius:8px;background:#202124;color:white;max-width:300px;box-shadow:0 2px 8px #0006'
    const text = document.createElement('div')
    const buttons = document.createElement('div')
    buttons.style.cssText = 'display:flex;gap:8px;margin-top:8px'
    const button = (label: string, record: boolean, background: string) => {
        const b = document.createElement('button')
        b.textContent = label
        b.style.cssText = `flex:1;cursor:pointer;border:0;border-radius:6px;padding:6px;color:white;background:${background}`
        b.addEventListener('click', () => done(record))
        return b
    }
    buttons.append(button('Record', true, '#a50e0e'), button("Don't record", false, '#5f6368'))
    box.append(text, buttons)
    parent.appendChild(box)

    let left = Math.ceil(ms / 1000)
    const render = () => (text.textContent = `Record this meeting? Recording is selected in ${left}s.`)
    render()
    const tick = setInterval(() => {
        left = Math.max(0, left - 1)
        render()
    }, 1000)
    const timer = setTimeout(() => done(true), ms)
    let finished = false
    function done(record?: boolean) {
        if (finished) return
        finished = true
        clearInterval(tick)
        clearTimeout(timer)
        box.remove()
        if (record !== undefined) onChoice(record)
    }
    return () => done()
}
