/**
 * NOVA DAW — Sampler Engine
 * Load and play audio samples (WAV/MP3) via Web Audio API.
 * 8 sample slots with pitch, volume, pan, loop, and trim controls.
 */

const NUM_SLOTS = 8;
const DEFAULT_PARAMS = {
    volume: 0.8,
    pitch: 1.0,
    pan: 0,
    startOffset: 0,
    endOffset: 0,
    loop: false
};

export default class Sampler {
    constructor(audioContext, destinationNode) {
        this.ctx = audioContext;
        this.destination = destinationNode;

        this.output = this.ctx.createGain();
        this.output.gain.value = 0.8;
        this.output.connect(this.destination);

        this.slots = [];
        for (let i = 0; i < NUM_SLOTS; i++) {
            this.slots.push({
                buffer: null,
                name: '',
                params: { ...DEFAULT_PARAMS },
                activeSources: []
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  Sample Loading
    // ═══════════════════════════════════════════════════════

    async loadFromFile(slotIndex, file) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return;
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.slots[slotIndex].buffer = audioBuffer;
        this.slots[slotIndex].name = file.name;
    }

    async loadFromURL(slotIndex, url) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return;
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.slots[slotIndex].buffer = audioBuffer;
        this.slots[slotIndex].name = url.split('/').pop() || 'sample';
    }

    loadFromBuffer(slotIndex, audioBuffer) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return;
        this.slots[slotIndex].buffer = audioBuffer;
    }

    unload(slotIndex) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return;
        this.stop(slotIndex);
        this.slots[slotIndex].buffer = null;
        this.slots[slotIndex].name = '';
    }

    getSlotInfo(slotIndex) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return null;
        const slot = this.slots[slotIndex];
        if (!slot.buffer) return { loaded: false, name: '', duration: 0, sampleRate: 0, channels: 0 };
        return {
            loaded: true,
            name: slot.name,
            duration: slot.buffer.duration,
            sampleRate: slot.buffer.sampleRate,
            channels: slot.buffer.numberOfChannels
        };
    }

    // ═══════════════════════════════════════════════════════
    //  Playback
    // ═══════════════════════════════════════════════════════

    play(slotIndex, time = null, options = {}) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return null;
        const slot = this.slots[slotIndex];
        if (!slot.buffer) return null;

        const t = time ?? this.ctx.currentTime;
        const p = slot.params;
        const pitch = options.pitch ?? p.pitch;
        const startOffset = options.startOffset ?? p.startOffset;
        const velocity = options.velocity ?? 1.0;
        const loop = options.loop ?? p.loop;

        // Create source
        const source = this.ctx.createBufferSource();
        source.buffer = slot.buffer;
        source.playbackRate.value = Math.max(0.25, Math.min(4.0, pitch));
        source.loop = loop;
        if (loop) {
            source.loopStart = options.loopStart ?? p.startOffset;
            source.loopEnd = options.loopEnd ?? (slot.buffer.duration - p.endOffset);
        }

        // Gain for velocity
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, p.volume * velocity));

        // Pan
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, p.pan));

        // Routing: source → gain → pan → output
        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(this.output);

        // Calculate duration
        const bufDuration = slot.buffer.duration - startOffset - p.endOffset;
        const duration = options.duration ?? (loop ? undefined : bufDuration);

        // Start
        if (duration && !loop) {
            source.start(t, startOffset, duration);
        } else {
            source.start(t, startOffset);
        }

        // Track active source
        const entry = { source, gainNode, panner };
        slot.activeSources.push(entry);

        // Cleanup on end
        source.onended = () => {
            const idx = slot.activeSources.indexOf(entry);
            if (idx !== -1) slot.activeSources.splice(idx, 1);
            try { source.disconnect(); } catch (_) {}
            try { gainNode.disconnect(); } catch (_) {}
            try { panner.disconnect(); } catch (_) {}
        };

        return {
            source,
            gainNode,
            stop: () => {
                try { source.stop(); } catch (_) {}
            }
        };
    }

    trigger(slotIndex, time, velocity = 1.0) {
        this.play(slotIndex, time, { velocity });
    }

    stop(slotIndex) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return;
        const slot = this.slots[slotIndex];
        for (const entry of [...slot.activeSources]) {
            try { entry.source.stop(); } catch (_) {}
        }
        slot.activeSources = [];
    }

    stopAll() {
        for (let i = 0; i < NUM_SLOTS; i++) {
            this.stop(i);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  Per-Slot Parameters
    // ═══════════════════════════════════════════════════════

    setSlotParam(slotIndex, param, value) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return;
        if (param in this.slots[slotIndex].params) {
            this.slots[slotIndex].params[param] = value;
        }
    }

    getSlotParam(slotIndex, param) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return undefined;
        return this.slots[slotIndex].params[param];
    }

    // ═══════════════════════════════════════════════════════
    //  Waveform Data (for UI visualization)
    // ═══════════════════════════════════════════════════════

    getWaveformData(slotIndex, numPoints = 200) {
        if (slotIndex < 0 || slotIndex >= NUM_SLOTS) return new Float32Array(numPoints);
        const slot = this.slots[slotIndex];
        if (!slot.buffer) return new Float32Array(numPoints);

        const channel = slot.buffer.getChannelData(0);
        const result = new Float32Array(numPoints);
        const blockSize = Math.floor(channel.length / numPoints);

        for (let i = 0; i < numPoints; i++) {
            let sum = 0;
            const start = i * blockSize;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channel[start + j]);
            }
            result[i] = sum / blockSize;
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════
    //  Cleanup
    // ═══════════════════════════════════════════════════════

    dispose() {
        this.stopAll();
        try { this.output.disconnect(); } catch (_) {}
        for (const slot of this.slots) {
            slot.buffer = null;
            slot.activeSources = [];
        }
    }
}
