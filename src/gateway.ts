import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WEBM, WebMOutputFormat } from 'mediabunny'

/**
 * JulyGateway upload (docs/JULY_GATEWAY_API.md). One POST hands the meeting audio to the gateway,
 * which transcribes and analyzes it server-side; the extension does not wait for results.
 * Provider keys stay on the gateway; the extension only holds its own revocable application token.
 */
export interface GatewayConfig {
    /** Full upload endpoint from Settings, e.g. https://<gateway-host>/v1/transcriptions (only the meeting query string is appended). */
    url: string
    token: string
    fetch?: typeof fetch
    retryDelayMs?: number
}

// ponytail: single upload, gateway limit 25 MiB. Split into chunks if meetings outgrow it.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const UPLOAD_ATTEMPTS = 3

/**
 * Returns the file as-is when it is already WebM with Opus audio only (the gateway's only accepted format);
 * otherwise converts its audio to Opus/WebM. Bitrate is left to mediabunny's default (high quality).
 */
export async function toWebmOpus(file: Blob): Promise<Blob> {
    using input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
    const [format, audio, videos] = await Promise.all([
        input.getFormat(),
        input.getPrimaryAudioTrack(),
        input.getVideoTracks(),
    ])
    if (format === WEBM && audio?.codec === 'opus' && videos.length === 0) return file

    const target = new BufferTarget()
    const conversion = await Conversion.init({
        input,
        output: new Output({ format: new WebMOutputFormat(), target }),
        tracks: 'primary',
        video: { discard: true },
        audio: { codec: 'opus', forceTranscode: audio?.codec !== 'opus' },
        showWarnings: false,
    })
    if (!conversion.isValid) {
        throw new Error(`Cannot convert audio: ${conversion.discardedTracks.map(t => t.reason).join(', ')}`)
    }
    await conversion.execute()
    if (!target.buffer) throw new Error('Audio conversion produced no data')
    return new Blob([target.buffer], { type: 'audio/webm' })
}

/** Gateway query-string limits for the email minutes (docs/JULY_GATEWAY_API.md). */
const MAX_TITLE = 200
const MAX_PARTICIPANTS = 50
const MAX_NAME = 100
// Code points, not UTF-16 units: the gateway counts characters, and a cut must not split an emoji.
const clip = (text: string, max: number) => [...text.trim()].slice(0, max).join('')

/** Upload URL with optional `title` and repeated `participants` params (URL-encoded, clipped to gateway limits). */
export function uploadUrl(base: string, meeting?: { title?: string; participants?: string[] }): string {
    const url = new URL(base)
    const title = clip(meeting?.title ?? '', MAX_TITLE)
    if (title) url.searchParams.set('title', title)
    const names = [...new Set((meeting?.participants ?? []).map(name => clip(name, MAX_NAME)).filter(Boolean))]
    for (const name of names.slice(0, MAX_PARTICIPANTS)) url.searchParams.append('participants', name)
    return url.href
}

/**
 * Uploads audio to the configured upload URL (`POST /v1/transcriptions` in the gateway docs) and returns the gateway job id once accepted (HTTP 202).
 * Network errors, 429 and 5xx are retried with the same idempotency key so a lost response never duplicates the job.
 */
export async function uploadRecording(
    audio: Blob,
    config: GatewayConfig,
    meeting?: { title?: string; participants?: string[] },
): Promise<string> {
    if (audio.size > MAX_UPLOAD_BYTES) {
        throw new Error(`Audio is ${Math.round(audio.size / 1048576)} MB, above the 25 MB upload limit`)
    }
    const doFetch = config.fetch ?? fetch
    const url = uploadUrl(config.url, meeting)
    const idempotencyKey = crypto.randomUUID()
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await doFetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.token}`,
                    // Gateway accepts exactly "audio/webm" (no codecs parameter).
                    'Content-Type': 'audio/webm',
                    'Idempotency-Key': idempotencyKey,
                },
                body: audio,
            })
            if (response.status === 202) return ((await response.json()) as { job_id: string }).job_id
            const transient = response.status === 429 || response.status >= 500
            if (!transient || attempt >= UPLOAD_ATTEMPTS) {
                const detail = (await response.text().catch(() => '')).slice(0, 200)
                throw new Error(`Gateway upload failed (${response.status}): ${detail}`)
            }
        } catch (e) {
            if (!(e instanceof TypeError) || attempt >= UPLOAD_ATTEMPTS) throw e
        }
        await new Promise(resolve => setTimeout(resolve, config.retryDelayMs ?? 3000))
    }
}
