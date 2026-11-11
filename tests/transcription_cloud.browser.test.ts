import { describe, expect, it } from 'vitest'
import { ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, Input, Output, WavOutputFormat } from 'mediabunny'
import { compressForUpload } from '../src/transcription/cloud'

describe('compressForUpload', () => {
    it('re-encodes a stereo 48 kHz recording to mono 16 kHz Opus/WebM', async () => {
        const audio = new AudioBuffer({ numberOfChannels: 2, length: 48000 * 2, sampleRate: 48000 })
        audio.getChannelData(0).forEach((_, i, data) => (data[i] = Math.sin(i / 20)))
        const target = new BufferTarget()
        const output = new Output({ format: new WavOutputFormat(), target })
        const source = new AudioBufferSource({ codec: 'pcm-s16' })
        output.addAudioTrack(source)
        await output.start()
        await source.add(audio)
        await output.finalize()

        const compressed = await compressForUpload(new Blob([target.buffer!]))
        expect(compressed.type).toBe('audio/webm')
        using input = new Input({ formats: ALL_FORMATS, source: new BlobSource(compressed) })
        const track = await input.getPrimaryAudioTrack()
        expect(track?.codec).toBe('opus')
        expect(track?.numberOfChannels).toBe(1)
        expect(await input.computeDuration()).toBeGreaterThan(1.5)
    })
})
