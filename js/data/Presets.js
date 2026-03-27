export default class Presets {

    /**
     * Return every preset grouped by category.
     * @returns {Object<string, Array>}
     */
    static getAll() {
        return {
            Bass:  Presets._bass(),
            Lead:  Presets._lead(),
            Pad:   Presets._pad(),
            Keys:  Presets._keys(),
            FX:    Presets._fx(),
            Synth: Presets._synth()
        };
    }

    /**
     * Find a single preset by exact name (case-insensitive).
     */
    static getPresetByName(name) {
        const lower = name.toLowerCase();
        const all = Presets.getAll();
        for (const category of Object.values(all)) {
            for (const preset of category) {
                if (preset.name.toLowerCase() === lower) return preset;
            }
        }
        return null;
    }

    /**
     * Return the list of category names.
     */
    static getCategories() {
        return Object.keys(Presets.getAll());
    }

    // ── Bass ────────────────────────────────────────────────────────────

    static _bass() {
        return [
            {
                name: 'Sub Bass',
                category: 'Bass',
                osc1: { type: 'sine', octave: -1, detune: 0, gain: 1.0 },
                osc2: { type: 'sine', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 200, Q: 1 },
                filterEnv: { attack: 0.01, decay: 0.2, sustain: 1.0, release: 0.3, amount: 100 },
                ampEnv: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.3 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0, delay: 0, distortion: 0, chorus: 0 },
                glide: 0
            },
            {
                name: 'Reese Bass',
                category: 'Bass',
                osc1: { type: 'sawtooth', octave: -1, detune: -12, gain: 0.7 },
                osc2: { type: 'sawtooth', octave: -1, detune: 12, gain: 0.7 },
                filter: { type: 'lowpass', frequency: 400, Q: 2 },
                filterEnv: { attack: 0.01, decay: 0.5, sustain: 0.4, release: 0.3, amount: 800 },
                ampEnv: { attack: 0.01, decay: 0.4, sustain: 0.8, release: 0.3 },
                lfo: { type: 'sine', rate: 0.5, depth: 300, destination: 'filter' },
                effects: { reverb: 0, delay: 0, distortion: 0.15, chorus: 0 },
                glide: 0
            },
            {
                name: '808 Bass',
                category: 'Bass',
                osc1: { type: 'sine', octave: -1, detune: 0, gain: 1.0 },
                osc2: { type: 'sine', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 300, Q: 1 },
                filterEnv: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 0.5, amount: 2000 },
                ampEnv: { attack: 0.001, decay: 1.2, sustain: 0.3, release: 0.8 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0, delay: 0, distortion: 0.1, chorus: 0 },
                glide: 0.05
            },
            {
                name: 'Acid Bass',
                category: 'Bass',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.9 },
                osc2: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 300, Q: 12 },
                filterEnv: { attack: 0.001, decay: 0.2, sustain: 0.05, release: 0.1, amount: 6000 },
                ampEnv: { attack: 0.001, decay: 0.3, sustain: 0.6, release: 0.1 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0, delay: 0, distortion: 0.3, chorus: 0 },
                glide: 0.06
            },
            {
                name: 'Wobble Bass',
                category: 'Bass',
                osc1: { type: 'sawtooth', octave: -1, detune: 0, gain: 0.7 },
                osc2: { type: 'square', octave: -1, detune: 5, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 500, Q: 6 },
                filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.2, amount: 2000 },
                ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.2 },
                lfo: { type: 'sine', rate: 4, depth: 3000, destination: 'filter' },
                effects: { reverb: 0, delay: 0, distortion: 0.2, chorus: 0 },
                glide: 0
            },
            {
                name: 'Pluck Bass',
                category: 'Bass',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.8 },
                osc2: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 600, Q: 3 },
                filterEnv: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.1, amount: 3000 },
                ampEnv: { attack: 0.001, decay: 0.25, sustain: 0.15, release: 0.1 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0, delay: 0, distortion: 0, chorus: 0 },
                glide: 0
            }
        ];
    }

    // ── Lead ────────────────────────────────────────────────────────────

    static _lead() {
        return [
            {
                name: 'Supersaw Lead',
                category: 'Lead',
                osc1: { type: 'sawtooth', octave: 0, detune: -25, gain: 0.6 },
                osc2: { type: 'sawtooth', octave: 0, detune: 25, gain: 0.6 },
                filter: { type: 'lowpass', frequency: 3000, Q: 1 },
                filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.3, amount: 2000 },
                ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.3, delay: 0.15, distortion: 0, chorus: 0.2 },
                glide: 0
            },
            {
                name: 'Square Lead',
                category: 'Lead',
                osc1: { type: 'square', octave: 0, detune: 0, gain: 0.8 },
                osc2: { type: 'square', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 5000, Q: 1 },
                filterEnv: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.2, amount: 1000 },
                ampEnv: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.2 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.1, delay: 0, distortion: 0, chorus: 0.3 },
                glide: 0
            },
            {
                name: 'Pluck Lead',
                category: 'Lead',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.8 },
                osc2: { type: 'sawtooth', octave: 0, detune: 7, gain: 0.3 },
                filter: { type: 'lowpass', frequency: 2000, Q: 2 },
                filterEnv: { attack: 0.001, decay: 0.15, sustain: 0.05, release: 0.2, amount: 5000 },
                ampEnv: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.4 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.4, delay: 0.35, distortion: 0, chorus: 0 },
                glide: 0
            },
            {
                name: 'Detuned Lead',
                category: 'Lead',
                osc1: { type: 'sawtooth', octave: 0, detune: 8, gain: 0.7 },
                osc2: { type: 'sawtooth', octave: 1, detune: -8, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 4000, Q: 1.5 },
                filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3, amount: 2000 },
                ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
                lfo: { type: 'sine', rate: 5, depth: 10, destination: 'pitch' },
                effects: { reverb: 0.2, delay: 0.2, distortion: 0, chorus: 0 },
                glide: 0
            },
            {
                name: 'Mono Lead',
                category: 'Lead',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.9 },
                osc2: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 800, Q: 4 },
                filterEnv: { attack: 0.001, decay: 0.2, sustain: 0.3, release: 0.15, amount: 4500 },
                ampEnv: { attack: 0.001, decay: 0.15, sustain: 0.7, release: 0.15 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.1, delay: 0.1, distortion: 0.1, chorus: 0 },
                glide: 0.08
            }
        ];
    }

    // ── Pad ─────────────────────────────────────────────────────────────

    static _pad() {
        return [
            {
                name: 'Warm Pad',
                category: 'Pad',
                osc1: { type: 'sawtooth', octave: 0, detune: -7, gain: 0.5 },
                osc2: { type: 'sawtooth', octave: 0, detune: 7, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 1200, Q: 1 },
                filterEnv: { attack: 0.5, decay: 0.6, sustain: 0.7, release: 1.0, amount: 800 },
                ampEnv: { attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.5 },
                lfo: { type: 'sine', rate: 0.3, depth: 200, destination: 'filter' },
                effects: { reverb: 0.5, delay: 0.1, distortion: 0, chorus: 0.2 },
                glide: 0
            },
            {
                name: 'Dark Pad',
                category: 'Pad',
                osc1: { type: 'square', octave: 0, detune: 0, gain: 0.5 },
                osc2: { type: 'triangle', octave: -1, detune: 5, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 500, Q: 2 },
                filterEnv: { attack: 0.8, decay: 1.0, sustain: 0.5, release: 1.5, amount: 400 },
                ampEnv: { attack: 1.0, decay: 0.8, sustain: 0.7, release: 2.0 },
                lfo: { type: 'sine', rate: 0.2, depth: 300, destination: 'filter' },
                effects: { reverb: 0.4, delay: 0.2, distortion: 0, chorus: 0 },
                glide: 0
            },
            {
                name: 'Shimmer Pad',
                category: 'Pad',
                osc1: { type: 'triangle', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'sine', octave: 1, detune: 5, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 6000, Q: 0.7 },
                filterEnv: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 1.2, amount: 1000 },
                ampEnv: { attack: 0.5, decay: 0.4, sustain: 0.85, release: 1.8 },
                lfo: { type: 'triangle', rate: 3, depth: 15, destination: 'pitch' },
                effects: { reverb: 0.7, delay: 0.3, distortion: 0, chorus: 0.6 },
                glide: 0
            },
            {
                name: 'Evolving Pad',
                category: 'Pad',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.7 },
                osc2: { type: 'sawtooth', octave: 0, detune: 10, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 800, Q: 3 },
                filterEnv: { attack: 1.5, decay: 1.0, sustain: 0.5, release: 2.0, amount: 2000 },
                ampEnv: { attack: 2.0, decay: 1.0, sustain: 0.7, release: 3.0 },
                lfo: { type: 'sine', rate: 0.1, depth: 1500, destination: 'filter' },
                effects: { reverb: 0.5, delay: 0.25, distortion: 0, chorus: 0.3 },
                glide: 0
            },
            {
                name: 'Glass Pad',
                category: 'Pad',
                osc1: { type: 'sine', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'triangle', octave: 1, detune: 3, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 5000, Q: 1 },
                filterEnv: { attack: 0.1, decay: 0.4, sustain: 0.7, release: 1.0, amount: 1500 },
                ampEnv: { attack: 0.05, decay: 0.3, sustain: 0.8, release: 1.5 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.6, delay: 0.15, distortion: 0, chorus: 0.2 },
                glide: 0
            }
        ];
    }

    // ── Keys ────────────────────────────────────────────────────────────

    static _keys() {
        return [
            {
                name: 'Electric Piano',
                category: 'Keys',
                osc1: { type: 'sine', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'triangle', octave: 0, detune: 3, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 3000, Q: 1 },
                filterEnv: { attack: 0.001, decay: 0.4, sustain: 0.3, release: 0.3, amount: 2000 },
                ampEnv: { attack: 0.001, decay: 0.5, sustain: 0.4, release: 0.4 },
                lfo: { type: 'sine', rate: 4, depth: 5, destination: 'pitch' },
                effects: { reverb: 0.25, delay: 0.1, distortion: 0, chorus: 0.15 },
                glide: 0
            },
            {
                name: 'Organ',
                category: 'Keys',
                osc1: { type: 'square', octave: 0, detune: 0, gain: 0.5 },
                osc2: { type: 'square', octave: 1, detune: 0, gain: 0.3 },
                filter: { type: 'lowpass', frequency: 8000, Q: 0.5 },
                filterEnv: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.1, amount: 0 },
                ampEnv: { attack: 0.01, decay: 0.05, sustain: 1.0, release: 0.08 },
                lfo: { type: 'sine', rate: 6, depth: 8, destination: 'pitch' },
                effects: { reverb: 0.2, delay: 0, distortion: 0.1, chorus: 0.2 },
                glide: 0
            },
            {
                name: 'Bell',
                category: 'Keys',
                osc1: { type: 'sine', octave: 0, detune: 0, gain: 0.7 },
                osc2: { type: 'sine', octave: 2, detune: 0, gain: 0.3 },
                filter: { type: 'lowpass', frequency: 6000, Q: 1 },
                filterEnv: { attack: 0.001, decay: 0.6, sustain: 0.1, release: 0.8, amount: 3000 },
                ampEnv: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.2 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.5, delay: 0.35, distortion: 0, chorus: 0 },
                glide: 0
            },
            {
                name: 'Marimba',
                category: 'Keys',
                osc1: { type: 'triangle', octave: 0, detune: 0, gain: 0.9 },
                osc2: { type: 'sine', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 4000, Q: 1 },
                filterEnv: { attack: 0.001, decay: 0.2, sustain: 0.05, release: 0.1, amount: 2000 },
                ampEnv: { attack: 0.001, decay: 0.3, sustain: 0.05, release: 0.15 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0, delay: 0, distortion: 0, chorus: 0 },
                glide: 0
            },
            {
                name: 'Clav',
                category: 'Keys',
                osc1: { type: 'square', octave: 0, detune: 0, gain: 0.8 },
                osc2: { type: 'square', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 2500, Q: 3 },
                filterEnv: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.05, amount: 4000 },
                ampEnv: { attack: 0.001, decay: 0.12, sustain: 0.05, release: 0.05 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0, delay: 0, distortion: 0.15, chorus: 0 },
                glide: 0
            }
        ];
    }

    // ── FX ───────────────────────────────────────────────────────────────

    static _fx() {
        return [
            {
                name: 'Riser',
                category: 'FX',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.7 },
                osc2: { type: 'sawtooth', octave: 0, detune: 15, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 400, Q: 4 },
                filterEnv: { attack: 3.0, decay: 0.1, sustain: 1.0, release: 0.5, amount: 8000 },
                ampEnv: { attack: 3.0, decay: 0.1, sustain: 0.9, release: 0.5 },
                lfo: { type: 'sine', rate: 0.15, depth: 50, destination: 'pitch' },
                effects: { reverb: 0.4, delay: 0.2, distortion: 0, chorus: 0.3 },
                glide: 0
            },
            {
                name: 'Sweep',
                category: 'FX',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'sawtooth', octave: 0, detune: 20, gain: 0.4 },
                filter: { type: 'bandpass', frequency: 1000, Q: 8 },
                filterEnv: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 0.5, amount: 3000 },
                ampEnv: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.0 },
                lfo: { type: 'sine', rate: 0.8, depth: 4000, destination: 'filter' },
                effects: { reverb: 0.3, delay: 0.15, distortion: 0, chorus: 0 },
                glide: 0
            },
            {
                name: 'Noise Wash',
                category: 'FX',
                osc1: { type: 'sawtooth', octave: 0, detune: 50, gain: 0.3 },
                osc2: { type: 'square', octave: 0, detune: -50, gain: 0.3 },
                filter: { type: 'lowpass', frequency: 800, Q: 1 },
                filterEnv: { attack: 1.5, decay: 1.0, sustain: 0.4, release: 2.0, amount: 2000 },
                ampEnv: { attack: 2.0, decay: 0.5, sustain: 0.6, release: 3.0 },
                lfo: { type: 'sine', rate: 0.3, depth: 500, destination: 'filter' },
                effects: { reverb: 0.7, delay: 0.2, distortion: 0, chorus: 0.4 },
                glide: 0
            },
            {
                name: 'Glitch',
                category: 'FX',
                osc1: { type: 'square', octave: 0, detune: 0, gain: 0.8 },
                osc2: { type: 'square', octave: 1, detune: 0, gain: 0.3 },
                filter: { type: 'lowpass', frequency: 4000, Q: 2 },
                filterEnv: { attack: 0.001, decay: 0.05, sustain: 0.2, release: 0.05, amount: 3000 },
                ampEnv: { attack: 0.001, decay: 0.08, sustain: 0.3, release: 0.05 },
                lfo: { type: 'square', rate: 12, depth: 400, destination: 'pitch' },
                effects: { reverb: 0, delay: 0.1, distortion: 0.5, chorus: 0 },
                glide: 0
            },
            {
                name: 'Sub Drop',
                category: 'FX',
                osc1: { type: 'sine', octave: -2, detune: 0, gain: 1.0 },
                osc2: { type: 'sine', octave: 0, detune: 0, gain: 0.0 },
                filter: { type: 'lowpass', frequency: 2000, Q: 1 },
                filterEnv: { attack: 0.001, decay: 2.0, sustain: 0.0, release: 0.5, amount: -1800 },
                ampEnv: { attack: 0.001, decay: 2.5, sustain: 0.0, release: 0.3 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.2, delay: 0, distortion: 0.1, chorus: 0 },
                glide: 0
            }
        ];
    }

    // ── Synth ───────────────────────────────────────────────────────────

    static _synth() {
        return [
            {
                name: 'Classic Analog',
                category: 'Synth',
                osc1: { type: 'sawtooth', octave: 0, detune: -5, gain: 0.6 },
                osc2: { type: 'sawtooth', octave: 0, detune: 5, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 2000, Q: 2 },
                filterEnv: { attack: 0.01, decay: 0.4, sustain: 0.4, release: 0.3, amount: 2500 },
                ampEnv: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.3 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.15, delay: 0, distortion: 0, chorus: 0.1 },
                glide: 0
            },
            {
                name: 'Digital Bright',
                category: 'Synth',
                osc1: { type: 'square', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'sawtooth', octave: 0, detune: 3, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 6000, Q: 1 },
                filterEnv: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2, amount: 2000 },
                ampEnv: { attack: 0.01, decay: 0.15, sustain: 0.8, release: 0.25 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.1, delay: 0.1, distortion: 0, chorus: 0.4 },
                glide: 0
            },
            {
                name: 'Brass Stab',
                category: 'Synth',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.8 },
                osc2: { type: 'sawtooth', octave: 0, detune: 10, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 1000, Q: 2 },
                filterEnv: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.15, amount: 5000 },
                ampEnv: { attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.15 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.2, delay: 0, distortion: 0, chorus: 0 },
                glide: 0
            },
            {
                name: 'String Ensemble',
                category: 'Synth',
                osc1: { type: 'sawtooth', octave: 0, detune: -10, gain: 0.5 },
                osc2: { type: 'sawtooth', octave: 0, detune: 10, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 3000, Q: 1 },
                filterEnv: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 0.8, amount: 1000 },
                ampEnv: { attack: 0.7, decay: 0.4, sustain: 0.85, release: 1.0 },
                lfo: { type: 'sine', rate: 5, depth: 8, destination: 'pitch' },
                effects: { reverb: 0.4, delay: 0, distortion: 0, chorus: 0.5 },
                glide: 0
            },
            {
                name: 'Choir',
                category: 'Synth',
                osc1: { type: 'triangle', octave: 0, detune: 0, gain: 0.5 },
                osc2: { type: 'sine', octave: 1, detune: 5, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 2500, Q: 1.5 },
                filterEnv: { attack: 0.8, decay: 0.5, sustain: 0.6, release: 1.0, amount: 1500 },
                ampEnv: { attack: 0.8, decay: 0.4, sustain: 0.7, release: 1.5 },
                lfo: { type: 'sine', rate: 5.5, depth: 10, destination: 'pitch' },
                effects: { reverb: 0.6, delay: 0.1, distortion: 0, chorus: 0.3 },
                glide: 0
            },
            {
                name: 'Retro Sync',
                category: 'Synth',
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.7 },
                osc2: { type: 'square', octave: 1, detune: 0, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 1500, Q: 5 },
                filterEnv: { attack: 0.001, decay: 0.25, sustain: 0.2, release: 0.2, amount: 5000 },
                ampEnv: { attack: 0.001, decay: 0.2, sustain: 0.6, release: 0.2 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                effects: { reverb: 0.15, delay: 0.2, distortion: 0.1, chorus: 0 },
                glide: 0.04
            }
        ];
    }
}
