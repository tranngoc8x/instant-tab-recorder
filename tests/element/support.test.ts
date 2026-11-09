import { render } from 'vitest-browser-lit'
import { html } from 'lit'
import { describe, test, expect, vi, afterEach } from 'vitest'
import { shadowQuery, shadowQueryAll, elementUpdated } from './test-helpers'

// Mock telemetry to keep console output out of test logs
vi.mock('../../src/telemetry', () => ({
    sendException: vi.fn(),
    sendEvent: vi.fn(),
}))

import '../../src/element/support'
import '../../src/element/alert'

describe('extension-support', () => {
    test('renders review section with Chrome Web Store link', async () => {
        const screen = render(html`<extension-support></extension-support>`)
        const el = screen.container.querySelector('extension-support')!
        await elementUpdated(el)

        const headings = shadowQueryAll(el, 'h2')
        const reviewHeading = headings.find(h => h.textContent?.trim() === 'Review')
        expect(reviewHeading).not.toBeUndefined()

        const reviewBtn = shadowQuery(el, '.review-section md-filled-tonal-button')
        expect(reviewBtn?.textContent?.trim()).toContain('Write a Review')
        expect(reviewBtn?.getAttribute('href')).toContain('chromewebstore.google.com')
    })

    test('renders support section with Buy Me a Coffee link', async () => {
        const screen = render(html`<extension-support></extension-support>`)
        const el = screen.container.querySelector('extension-support')!
        await elementUpdated(el)

        const link = shadowQuery<HTMLAnchorElement>(el, '.buymeacoffee-link')
        expect(link).not.toBeNull()
        expect(link?.getAttribute('href')).toContain('buymeacoffee.com')
    })

    // Sentry was removed: the feedback form and its bug-tracking opt-in must stay gone,
    // otherwise the extension is back to shipping user input off the device.
    test('renders no feedback form or bug tracking switch', async () => {
        const screen = render(html`<extension-support></extension-support>`)
        const el = screen.container.querySelector('extension-support')!
        await elementUpdated(el)

        const headings = shadowQueryAll(el, 'h2').map(h => h.textContent?.trim())
        expect(headings).not.toContain('Feedback')

        expect(shadowQuery(el, '.feedback-form')).toBeNull()
        expect(shadowQuery(el, 'md-filled-text-field')).toBeNull()
        expect(shadowQuery(el, 'md-filled-select')).toBeNull()
        expect(shadowQuery(el, 'md-switch')).toBeNull()
    })

    test('renders Support Development section', async () => {
        const screen = render(html`<extension-support></extension-support>`)
        const el = screen.container.querySelector('extension-support')!
        await elementUpdated(el)

        const headings = shadowQueryAll(el, 'h2')
        const supportHeading = headings.find(h => h.textContent?.trim() === 'Support Development')
        expect(supportHeading).not.toBeUndefined()
    })

    test('renders legal section with Terms of Service and Privacy Policy buttons', async () => {
        const screen = render(html`<extension-support></extension-support>`)
        const el = screen.container.querySelector('extension-support')!
        await elementUpdated(el)

        const headings = shadowQueryAll(el, 'h2')
        const legalHeading = headings.find(h => h.textContent?.trim() === 'Legal')
        expect(legalHeading).not.toBeUndefined()

        // Legal heading should appear after License Information and before Review
        const headingTexts = headings.map(h => h.textContent?.trim())
        const licenseIdx = headingTexts.indexOf('License Information')
        const legalIdx = headingTexts.indexOf('Legal')
        const reviewIdx = headingTexts.indexOf('Review')
        expect(licenseIdx).toBeLessThan(legalIdx)
        expect(legalIdx).toBeLessThan(reviewIdx)

        const termsBtn = shadowQuery(el, '.legal-buttons md-filled-tonal-button[href*="TERMS.html"]')
        expect(termsBtn).not.toBeNull()
        expect(termsBtn?.textContent?.trim()).toContain('Terms of Service')
        expect(termsBtn?.getAttribute('target')).toBe('_blank')
        expect(termsBtn?.getAttribute('rel')).toBe('noopener')

        const privacyBtn = shadowQuery(el, '.legal-buttons md-filled-tonal-button[href*="PRIVACY.html"]')
        expect(privacyBtn).not.toBeNull()
        expect(privacyBtn?.textContent?.trim()).toContain('Privacy Policy')
        expect(privacyBtn?.getAttribute('target')).toBe('_blank')
        expect(privacyBtn?.getAttribute('rel')).toBe('noopener')
    })

    describe('open source licenses button', () => {
        let alertEl: HTMLElement

        afterEach(() => {
            vi.unstubAllGlobals()
            alertEl?.remove()
        })

        test('renders license section with button', async () => {
            const screen = render(html`<extension-support></extension-support>`)
            const el = screen.container.querySelector('extension-support')!
            await elementUpdated(el)

            const headings = shadowQueryAll(el, 'h2')
            const licenseHeading = headings.find(h => h.textContent?.trim() === 'License Information')
            expect(licenseHeading).not.toBeUndefined()

            // License heading should appear before Review heading
            const headingTexts = headings.map(h => h.textContent?.trim())
            const licenseIdx = headingTexts.indexOf('License Information')
            const reviewIdx = headingTexts.indexOf('Review')
            expect(licenseIdx).toBeLessThan(reviewIdx)
        })

        test('opens alert modal with license content on button click', async () => {
            const licenseContent = '# Licenses\n\nMIT License\n\nCopyright (c) 2024'
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(licenseContent),
            })
            vi.stubGlobal('fetch', fetchMock)

            alertEl = document.createElement('extension-alert')
            alertEl.id = 'alert-dialog'
            document.body.appendChild(alertEl)

            const screen = render(html`<extension-support></extension-support>`)
            const el = screen.container.querySelector('extension-support')!
            await elementUpdated(el)

            // Find and click the license button (first md-filled-tonal-button without href)
            const buttons = shadowQueryAll<HTMLElement>(el, 'md-filled-tonal-button')
            const licenseBtn = buttons.find(
                b => !b.hasAttribute('href') && b.textContent?.includes('Open Source Licenses'),
            )
            expect(licenseBtn).not.toBeUndefined()
            licenseBtn!.click()

            await vi.waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith('dist/dependencies-licenses.md')
                const dialog = alertEl.shadowRoot?.querySelector('md-dialog') as
                    | (HTMLElement & { open?: boolean })
                    | null
                expect(dialog).not.toBeNull()
                expect(dialog?.open).toBe(true)
                const headline = alertEl.shadowRoot?.querySelector('[slot="headline"]')
                expect(headline?.textContent).toBe('Open Source Licenses')
                const content = alertEl.shadowRoot?.querySelector('[slot="content"] pre')
                expect(content).not.toBeNull()
                expect(content?.textContent).toBe(licenseContent)
            })
        })

        test('shows error message when license fetch fails', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            })
            vi.stubGlobal('fetch', fetchMock)

            alertEl = document.createElement('extension-alert')
            alertEl.id = 'alert-dialog'
            document.body.appendChild(alertEl)

            const screen = render(html`<extension-support></extension-support>`)
            const el = screen.container.querySelector('extension-support')!
            await elementUpdated(el)

            const buttons = shadowQueryAll<HTMLElement>(el, 'md-filled-tonal-button')
            const licenseBtn = buttons.find(
                b => !b.hasAttribute('href') && b.textContent?.includes('Open Source Licenses'),
            )
            licenseBtn!.click()

            await vi.waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith('dist/dependencies-licenses.md')
                const dialog = alertEl.shadowRoot?.querySelector('md-dialog') as
                    | (HTMLElement & { open?: boolean })
                    | null
                expect(dialog).not.toBeNull()
                expect(dialog?.open).toBe(true)
                const content = alertEl.shadowRoot?.querySelector('[slot="content"]')
                expect(content?.textContent).toContain('Failed to load license information.')
            })
        })
    })
})
