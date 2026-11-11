import { describe, expect, it } from 'vitest'
import {
    ALL_FORMATS,
    AudioBufferSource,
    BlobSource,
    BufferTarget,
    Input,
    Output,
    WavOutputFormat,
    WebMOutputFormat,
    type OutputFormat,
} from 'mediabunny'
import { toWebmOpus } from '../src/gateway'

async function encode(format: OutputFormat, codec: 'pcm-s16' | 'opus'): Promise<Blob> {
    const audio = new AudioBuffer({ numberOfChannels: 2, length: 48000 * 2, sampleRate: 48000 })
    audio.getChannelData(0).forEach((_, i, data) => (data[i] = Math.sin(i / 20)))
    const target = new BufferTarget()
    const output = new Output({ format, target })
    const source = new AudioBufferSource({ codec, bitrate: 64000 })
    output.addAudioTrack(source)
    await output.start()
    await source.add(audio)
    await output.finalize()
    return new Blob([target.buffer!])
}

describe('toWebmOpus', () => {
    it('keeps a WebM/Opus file untouched', async () => {
        const webm = await encode(new WebMOutputFormat(), 'opus')
        expect(await toWebmOpus(webm)).toBe(webm)
    })

    it('converts other formats to WebM/Opus', async () => {
        const converted = await toWebmOpus(await encode(new WavOutputFormat(), 'pcm-s16'))
        expect(converted.type).toBe('audio/webm')
        using input = new Input({ formats: ALL_FORMATS, source: new BlobSource(converted) })
        expect((await input.getPrimaryAudioTrack())?.codec).toBe('opus')
        expect(await input.computeDuration()).toBeGreaterThan(1.5)
    })
})
