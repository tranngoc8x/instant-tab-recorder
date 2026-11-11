import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WebMOutputFormat } from 'mediabunny'
import { isTranscriptionSegment, type TranscriptionSegment } from './types'
import { cleanTranscriptionText } from './utils'

export const CLOUD_TRANSCRIPTION_URL = 'https://9router.hubs.io.vn/v1/audio/transcriptions'
export const CLOUD_TRANSCRIPTION_MODEL = 'groq/whisper-large-v3-turbo'
// ponytail: single-request upload; ~2.3h at 24kbps. Split into chunks if meetings run longer.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/** Re-encodes any recording to mono 16 kHz Opus/WebM (~11 MB per hour) so it fits the upload limit. */
export async function compressForUpload(source: Blob, signal?: AbortSignal): Promise<Blob> {
    using input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source) })
    const target = new BufferTarget()
    const conversion = await Conversion.init({
        input,
        output: new Output({ format: new WebMOutputFormat(), target }),
        tracks: 'primary',
        video: { discard: true },
        audio: { numberOfChannels: 1, sampleRate: 16000, codec: 'opus', bitrate: 24000 },
        showWarnings: false,
    })
    if (!conversion.isValid) {
        throw new Error(`Cannot convert audio: ${conversion.discardedTracks.map(t => t.reason).join(', ')}`)
    }
    signal?.addEventListener('abort', () => void conversion.cancel(), { once: true })
    await conversion.execute()
    signal?.throwIfAborted()
    if (!target.buffer) throw new Error('Audio conversion produced no data')
    return new Blob([target.buffer], { type: 'audio/webm' })
}

/** Maps an OpenAI-compatible `verbose_json` transcription response to stored segments. */
export function toSegments(body: unknown): TranscriptionSegment[] {
    const raw = (body as { segments?: unknown })?.segments
    if (!Array.isArray(raw)) throw new Error('Transcription API response has no segments')
    return raw
        .map(s => {
            const startSec = Number(Number(s?.start).toFixed(3))
            return {
                startSec,
                endSec: Math.max(startSec, Number(Number(s?.end).toFixed(3))),
                text: cleanTranscriptionText(String(s?.text ?? '')),
            }
        })
        .filter(s => s.text.length > 0 && isTranscriptionSegment(s))
}

export async function transcribeViaApi(
    audio: Blob,
    options: { apiKey: string; language: string; signal?: AbortSignal; fetch?: typeof fetch },
): Promise<TranscriptionSegment[]> {
    if (audio.size > MAX_UPLOAD_BYTES) {
        throw new Error(`Audio is ${Math.round(audio.size / 1048576)} MB, above the 25 MB upload limit`)
    }
    const form = new FormData()
    form.append('model', CLOUD_TRANSCRIPTION_MODEL)
    form.append('file', audio, 'meeting.webm')
    form.append('language', options.language)
    form.append('response_format', 'verbose_json')
    const response = await (options.fetch ?? fetch)(CLOUD_TRANSCRIPTION_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${options.apiKey}` },
        body: form,
        signal: options.signal,
    })
    if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 200)
        throw new Error(`Transcription API ${response.status}: ${detail}`)
    }
    return toSegments(await response.json())
}
