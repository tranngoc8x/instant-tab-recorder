import { html, css, LitElement } from 'lit'
import { customElement } from 'lit/decorators.js'
import '@material/web/icon/icon'
import '@material/web/button/filled-tonal-button'
import { sendException, sendEvent } from '../telemetry'
import Alert from './alert'
import { t } from '../i18n'

@customElement('extension-support')
export class Support extends LitElement {
    static override readonly styles = [
        css`
            :host {
                display: block;
            }
            md-filled-tonal-button {
                height: 56px;
                margin-bottom: 1em;
            }
            .legal-buttons {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 1em;
            }
            .legal-buttons md-filled-tonal-button {
                margin-bottom: 0;
            }
            .review-section p {
                font-size: 1.1em;
                margin-bottom: 1em;
            }
            .support-section p {
                font-size: 1.1em;
                margin-bottom: 1em;
                color: var(--theme-text-secondary, #666);
            }
            .buymeacoffee-link img {
                max-height: 60px;
            }
            a {
                text-decoration: none;
                color: var(--theme-link, inherit);
            }
        `,
    ]

    public override render() {
        return html`
            <h2>${t('supportLicenses')}</h2>
            <md-filled-tonal-button @click=${this.handleShowLicenses}>
                ${t('supportOpenSourceLicenses')}
                <md-icon slot="icon">description</md-icon>
            </md-filled-tonal-button>

            <h2>${t('supportTerms')}</h2>
            <div class="legal-buttons">
                <md-filled-tonal-button
                    href=${t('termsUrl')}
                    target="_blank"
                    rel="noopener"
                    @click=${this.handleTermsLink}>
                    ${t('termsLinkText')}
                    <md-icon slot="icon">description</md-icon>
                </md-filled-tonal-button>
                <md-filled-tonal-button
                    href=${t('privacyPolicyUrl')}
                    target="_blank"
                    rel="noopener"
                    @click=${this.handlePrivacyPolicyLink}>
                    ${t('privacyPolicyLinkText')}
                    <md-icon slot="icon">policy</md-icon>
                </md-filled-tonal-button>
            </div>

            <h2>${t('supportReview')}</h2>
            <div class="review-section">
                <p>${t('supportReviewDescription')}</p>
                <md-filled-tonal-button
                    href="https://chromewebstore.google.com/detail/instant-tab-recorder/giebbnikpnedbdojlghnnegpfbgdecmi/reviews"
                    target="_blank"
                    rel="noopener"
                    @click=${this.handleReviewLink}>
                    ${t('supportWriteReview')}
                    <md-icon slot="icon">rate_review</md-icon>
                </md-filled-tonal-button>
            </div>

            <h2>${t('supportDevelopment')}</h2>
            <div class="support-section">
                <p>${t('supportDevelopmentDescription')}</p>
                <a
                    class="buymeacoffee-link"
                    href="https://www.buymeacoffee.com/ww24"
                    target="_blank"
                    rel="noopener"
                    @click=${this.handleSupportLink}>
                    <img src="icons/buymeacoffee.png" alt="Buy Me a Coffee" />
                </a>
            </div>
        `
    }

    private handleSupportLink() {
        sendEvent({ type: 'click_external_link', tags: { link: 'support' } })
    }

    private handleReviewLink() {
        sendEvent({ type: 'click_external_link', tags: { link: 'review' } })
    }

    private handleTermsLink() {
        sendEvent({ type: 'click_external_link', tags: { link: 'terms' } })
    }

    private handlePrivacyPolicyLink() {
        sendEvent({ type: 'click_external_link', tags: { link: 'privacy' } })
    }

    private async handleShowLicenses() {
        const alertDialog = document.getElementById('alert-dialog') as Alert | null
        if (!alertDialog) return

        try {
            const path = 'dist/dependencies-licenses.md'
            const response = await fetch(path)
            if (!response.ok) throw new Error(`failed to fetch ${path}: HTTP ${response.status}`)
            const text = await response.text()
            alertDialog.setContent(t('supportOpenSourceLicenses'), text, { preformatted: true })
        } catch (e) {
            alertDialog.setContent(t('alertDefaultHeadline'), t('supportLicenseLoadError'))
            sendException(e, { exceptionSource: 'option.support.license' })
        }
        alertDialog.shadowRoot?.querySelector('md-dialog')?.show()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'extension-support': Support
    }
}
