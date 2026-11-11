import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WEBM, WebMOutputFormat } from 'mediabunny'

/**
 * JulyGateway upload (docs/JULY_GATEWAY_API.md). One POST hands the meeting audio to the gateway,
 * which transcribes and analyzes it server-side; the extension does not wait for results.
 * Provider keys stay on the gateway; the extension only holds its own revocable application token.
 */
export interface GatewayConfig {
    /** Full upload endpoint from Settings, e.g. https://<gateway-host>/v1/transcriptions (nothing appended). */
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

/**
 * Uploads audio to the configured upload URL (`POST /v1/transcriptions` in the gateway docs) and returns the gateway job id once accepted (HTTP 202).
 * Network errors, 429 and 5xx are retried with the same idempotency key so a lost response never duplicates the job.
 */
export async function uploadRecording(audio: Blob, config: GatewayConfig): Promise<string> {
    if (audio.size > MAX_UPLOAD_BYTES) {
        throw new Error(`Audio is ${Math.round(audio.size / 1048576)} MB, above the 25 MB upload limit`)
    }
    const doFetch = config.fetch ?? fetch
    const idempotencyKey = crypto.randomUUID()
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await doFetch(config.url, {
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
