/**
 * NOVA DAW — Song Templates
 * Complete starter tracks across genres. Each template includes
 * BPM, synth preset, drum pattern, piano roll notes, and effects.
 */

export default class SongTemplates {

    static getAll() {
        return {
            'Hip-Hop / Trap': [SongTemplates._midnightTrap(), SongTemplates._cloudRap()],
            'House / Dance': [SongTemplates._deepHouse(), SongTemplates._futureHouse()],
            'Lo-fi / Chill': [SongTemplates._rainyDay(), SongTemplates._studySession()],
            'Pop': [SongTemplates._summerPop()],
            'R&B / Soul': [SongTemplates._lateNightRnB()],
            'Cinematic': [SongTemplates._epicOrchestral(), SongTemplates._ambientDrift()]
        };
    }

    static getByName(name) {
        for (const templates of Object.values(SongTemplates.getAll())) {
            const found = templates.find(t => t.name === name);
            if (found) return found;
        }
        return null;
    }

    static getByCategory(category) {
        return SongTemplates.getAll()[category] || [];
    }

    static getCategories() {
        return Object.keys(SongTemplates.getAll());
    }

    static getRandom() {
        const all = Object.values(SongTemplates.getAll()).flat();
        return all[Math.floor(Math.random() * all.length)];
    }

    // ── Helper: build chord notes from MIDI root + intervals across bars ──
    static _chordBar(rootMidi, intervals, startBeat, duration, velocity = 0.6) {
        return intervals.map(i => ({ midi: rootMidi + i, start: startBeat, duration, velocity }));
    }

    // ═══════════════════════════════════════════════════════════════
    //  TEMPLATES
    // ═══════════════════════════════════════════════════════════════

    static _midnightTrap() {
        // Cm - Ab - Bb - Fm | 140 BPM
        const chords = [
            ...SongTemplates._chordBar(48, [0,3,7,10], 0, 4, 0.55),   // Cm7
            ...SongTemplates._chordBar(44, [0,4,7,11], 4, 4, 0.55),   // Abmaj7
            ...SongTemplates._chordBar(46, [0,4,7], 8, 4, 0.55),      // Bb
            ...SongTemplates._chordBar(41, [0,3,7], 12, 4, 0.55),     // Fm
        ];
        const melody = [
            { midi: 72, start: 0, duration: 1, velocity: 0.7 },
            { midi: 70, start: 1.5, duration: 0.5, velocity: 0.6 },
            { midi: 67, start: 2, duration: 1, velocity: 0.65 },
            { midi: 68, start: 4, duration: 1.5, velocity: 0.7 },
            { midi: 67, start: 6, duration: 0.5, velocity: 0.55 },
            { midi: 65, start: 8, duration: 1, velocity: 0.7 },
            { midi: 63, start: 10, duration: 1, velocity: 0.6 },
            { midi: 60, start: 12, duration: 2, velocity: 0.65 },
        ];
        const bass = [
            { midi: 36, start: 0, duration: 3.5, velocity: 0.9 },
            { midi: 32, start: 4, duration: 3.5, velocity: 0.85 },
            { midi: 34, start: 8, duration: 3.5, velocity: 0.85 },
            { midi: 29, start: 12, duration: 3.5, velocity: 0.8 },
        ];
        return {
            name: 'Midnight Trap', category: 'Hip-Hop / Trap', bpm: 140, key: 0, scale: 'minor', swing: 0,
            description: 'Dark trap with 808s and atmospheric pads',
            synthPreset: {
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'square', octave: 0, detune: 8, gain: 0.3 },
                filter: { type: 'lowpass', frequency: 1800, Q: 2 },
                filterEnv: { attack: 0.05, decay: 0.4, sustain: 0.3, release: 0.6, amount: 2000 },
                ampEnv: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 0.8 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                glide: 0, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.9,null,null,null, null,null,0.8,null, null,null,0.7,null, 0.9,null,null,null],
                snare: [null,null,null,null, 0.9,null,null,null, null,null,null,null, 0.9,null,null,null],
                hihatC: [0.8,0.4,0.7,0.4, 0.8,0.4,0.8,0.5, 0.8,0.5,0.8,0.4, 0.8,0.5,0.9,0.5],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,0.5],
                clap: [null,null,null,null, 0.8,null,null,null, null,null,null,null, 0.8,null,null,null],
                rim: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords, ...melody, ...bass],
            effects: { reverb: { wetDry: 0.3, roomSize: 0.5, bypass: false }, delay: { wetDry: 0.15, feedback: 0.3, bypass: false }, chorus: { wetDry: 0, bypass: true }, distortion: { amount: 0, bypass: true } }
        };
    }

    static _cloudRap() {
        const chords = [
            ...SongTemplates._chordBar(54, [0,3,7,10], 0, 4, 0.5),   // F#m7
            ...SongTemplates._chordBar(49, [0,4,7,11], 4, 4, 0.5),   // Dbmaj7
            ...SongTemplates._chordBar(52, [0,3,7], 8, 4, 0.5),      // Em (enharmonic)
            ...SongTemplates._chordBar(47, [0,4,7], 12, 4, 0.5),     // B
        ];
        const melody = [
            { midi: 78, start: 0.5, duration: 1.5, velocity: 0.6 },
            { midi: 76, start: 2.5, duration: 1, velocity: 0.5 },
            { midi: 73, start: 4, duration: 2, velocity: 0.6 },
            { midi: 71, start: 8, duration: 1.5, velocity: 0.55 },
            { midi: 73, start: 10, duration: 1, velocity: 0.5 },
            { midi: 66, start: 12, duration: 3, velocity: 0.55 },
        ];
        return {
            name: 'Cloud Rap', category: 'Hip-Hop / Trap', bpm: 150, key: 6, scale: 'minor', swing: 0,
            description: 'Dreamy trap with ethereal pads and slow melodies',
            synthPreset: {
                osc1: { type: 'sine', octave: 0, detune: 0, gain: 0.7 },
                osc2: { type: 'triangle', octave: 1, detune: 5, gain: 0.25 },
                filter: { type: 'lowpass', frequency: 3000, Q: 1 },
                filterEnv: { attack: 0.3, decay: 0.5, sustain: 0.5, release: 1.5, amount: 1500 },
                ampEnv: { attack: 0.3, decay: 0.5, sustain: 0.7, release: 2.0 },
                lfo: { type: 'sine', rate: 0.5, depth: 0.1, destination: 'filter' },
                glide: 0.05, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.8,null,null,null, null,null,null,null, null,null,0.7,null, null,null,null,null],
                snare: [null,null,null,null, 0.7,null,null,null, null,null,null,null, 0.7,null,null,null],
                hihatC: [0.5,null,0.4,null, 0.5,null,0.4,null, 0.5,null,0.4,null, 0.5,null,0.4,null],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                clap: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                rim: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords, ...melody],
            effects: { reverb: { wetDry: 0.5, roomSize: 0.8, bypass: false }, delay: { wetDry: 0.25, feedback: 0.35, bypass: false }, chorus: { wetDry: 0.15, bypass: false }, distortion: { amount: 0, bypass: true } }
        };
    }

    static _deepHouse() {
        // Am7 - Dm7 - G7 - Cmaj7
        const chords = [
            ...SongTemplates._chordBar(57, [0,3,7,10], 0, 4, 0.55),
            ...SongTemplates._chordBar(50, [0,3,7,10], 4, 4, 0.55),
            ...SongTemplates._chordBar(55, [0,4,7,10], 8, 4, 0.55),
            ...SongTemplates._chordBar(48, [0,4,7,11], 12, 4, 0.55),
        ];
        const bass = [
            { midi: 45, start: 0, duration: 0.4, velocity: 0.8 }, { midi: 45, start: 1, duration: 0.4, velocity: 0.7 },
            { midi: 45, start: 2, duration: 0.4, velocity: 0.75 }, { midi: 52, start: 3, duration: 0.4, velocity: 0.65 },
            { midi: 38, start: 4, duration: 0.4, velocity: 0.8 }, { midi: 38, start: 5, duration: 0.4, velocity: 0.7 },
            { midi: 38, start: 6, duration: 0.4, velocity: 0.75 }, { midi: 45, start: 7, duration: 0.4, velocity: 0.65 },
            { midi: 43, start: 8, duration: 0.4, velocity: 0.8 }, { midi: 43, start: 9, duration: 0.4, velocity: 0.7 },
            { midi: 43, start: 10, duration: 0.4, velocity: 0.75 }, { midi: 47, start: 11, duration: 0.4, velocity: 0.65 },
            { midi: 36, start: 12, duration: 0.4, velocity: 0.8 }, { midi: 36, start: 13, duration: 0.4, velocity: 0.7 },
            { midi: 36, start: 14, duration: 0.4, velocity: 0.75 }, { midi: 43, start: 15, duration: 0.4, velocity: 0.65 },
        ];
        return {
            name: 'Deep House Groove', category: 'House / Dance', bpm: 122, key: 9, scale: 'minor', swing: 0,
            description: 'Warm deep house with walking bass and jazzy chords',
            synthPreset: {
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.5 },
                osc2: { type: 'sawtooth', octave: 0, detune: 10, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 3500, Q: 1.5 },
                filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.4, amount: 2000 },
                ampEnv: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.4 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                glide: 0, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null],
                snare: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                hihatC: [0.6,null,0.7,null, 0.6,null,0.7,null, 0.6,null,0.7,null, 0.6,null,0.7,null],
                hihatO: [null,null,null,null, null,null,null,0.5, null,null,null,null, null,null,null,0.5],
                clap: [null,null,null,null, 0.8,null,null,null, null,null,null,null, 0.8,null,null,null],
                rim: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords, ...bass],
            effects: { reverb: { wetDry: 0.2, roomSize: 0.4, bypass: false }, delay: { wetDry: 0.1, feedback: 0.2, bypass: false }, chorus: { wetDry: 0.1, bypass: false }, distortion: { amount: 0, bypass: true } }
        };
    }

    static _futureHouse() {
        const chords = [
            ...SongTemplates._chordBar(50, [0,3,7], 0, 4, 0.6),
            ...SongTemplates._chordBar(53, [0,4,7], 4, 4, 0.6),
            ...SongTemplates._chordBar(48, [0,4,7], 8, 4, 0.6),
            ...SongTemplates._chordBar(46, [0,4,7,10], 12, 4, 0.6),
        ];
        return {
            name: 'Future House', category: 'House / Dance', bpm: 128, key: 2, scale: 'minor', swing: 0,
            description: 'Driving future house with saw bass and bright chords',
            synthPreset: {
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.8 },
                osc2: { type: 'square', octave: 0, detune: 5, gain: 0.3 },
                filter: { type: 'lowpass', frequency: 5000, Q: 3 },
                filterEnv: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.2, amount: 4000 },
                ampEnv: { attack: 0.005, decay: 0.15, sustain: 0.5, release: 0.2 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                glide: 0, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null],
                snare: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                hihatC: [0.7,0.4,0.7,0.4, 0.7,0.4,0.7,0.4, 0.7,0.4,0.7,0.4, 0.7,0.4,0.7,0.4],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                clap: [null,null,null,null, 0.9,null,null,null, null,null,null,null, 0.9,null,null,null],
                rim: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords],
            effects: { reverb: { wetDry: 0.15, roomSize: 0.3, bypass: false }, delay: { wetDry: 0.1, feedback: 0.2, bypass: false }, chorus: { wetDry: 0, bypass: true }, distortion: { amount: 0.1, wetDry: 0.3, bypass: false } }
        };
    }

    static _rainyDay() {
        // Ebm - Cb - Gb - Db (= Eb minor)
        const chords = [
            ...SongTemplates._chordBar(51, [0,3,7,10], 0, 4, 0.45),
            ...SongTemplates._chordBar(47, [0,4,7,11], 4, 4, 0.45),
            ...SongTemplates._chordBar(54, [0,4,7], 8, 4, 0.45),
            ...SongTemplates._chordBar(49, [0,4,7], 12, 4, 0.45),
        ];
        const melody = [
            { midi: 75, start: 0.5, duration: 1.5, velocity: 0.5 },
            { midi: 73, start: 2.5, duration: 1, velocity: 0.45 },
            { midi: 71, start: 4, duration: 2, velocity: 0.5 },
            { midi: 70, start: 8, duration: 1, velocity: 0.45 },
            { midi: 68, start: 9.5, duration: 1.5, velocity: 0.5 },
            { midi: 66, start: 12, duration: 3, velocity: 0.45 },
        ];
        return {
            name: 'Rainy Day', category: 'Lo-fi / Chill', bpm: 78, key: 3, scale: 'minor', swing: 30,
            description: 'Warm lo-fi beat with mellow piano and gentle rain vibes',
            synthPreset: {
                osc1: { type: 'sine', octave: 0, detune: 0, gain: 0.7 },
                osc2: { type: 'triangle', octave: 0, detune: 3, gain: 0.3 },
                filter: { type: 'lowpass', frequency: 2200, Q: 0.8 },
                filterEnv: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.6, amount: 1000 },
                ampEnv: { attack: 0.01, decay: 0.5, sustain: 0.4, release: 0.8 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                glide: 0, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.7,null,null,null, null,null,null,null, null,0.5,null,null, null,null,null,null],
                snare: [null,null,null,null, 0.6,null,null,null, null,null,null,null, 0.6,null,null,null],
                hihatC: [0.4,null,0.3,null, 0.4,null,0.3,null, 0.4,null,0.3,null, 0.4,null,0.3,null],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                clap: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                rim: [null,null,0.3,null, null,null,null,null, null,null,0.3,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords, ...melody],
            effects: { reverb: { wetDry: 0.25, roomSize: 0.4, bypass: false }, delay: { wetDry: 0.1, feedback: 0.2, bypass: false }, chorus: { wetDry: 0.1, bypass: false }, distortion: { amount: 0, bypass: true } }
        };
    }

    static _studySession() {
        const chords = [
            ...SongTemplates._chordBar(55, [0,3,7,10], 0, 4, 0.45),
            ...SongTemplates._chordBar(48, [0,4,7,11], 4, 4, 0.45),
            ...SongTemplates._chordBar(53, [0,3,7], 8, 4, 0.45),
            ...SongTemplates._chordBar(50, [0,4,7], 12, 4, 0.45),
        ];
        return {
            name: 'Study Session', category: 'Lo-fi / Chill', bpm: 85, key: 7, scale: 'minor', swing: 25,
            description: 'Mellow lo-fi with soft keys and gentle drums',
            synthPreset: {
                osc1: { type: 'sine', octave: 0, detune: 0, gain: 0.8 },
                osc2: { type: 'triangle', octave: 0, detune: 2, gain: 0.2 },
                filter: { type: 'lowpass', frequency: 2500, Q: 0.5 },
                filterEnv: { attack: 0.005, decay: 0.5, sustain: 0.3, release: 0.6, amount: 800 },
                ampEnv: { attack: 0.005, decay: 0.5, sustain: 0.3, release: 0.6 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                glide: 0, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.7,null,null,null, null,null,0.5,null, null,null,null,null, 0.6,null,null,null],
                snare: [null,null,null,null, 0.5,null,null,null, null,null,null,null, 0.5,null,null,0.3],
                hihatC: [0.4,0.2,0.4,0.2, 0.4,0.2,0.4,0.2, 0.4,0.2,0.4,0.2, 0.4,0.2,0.4,0.2],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                clap: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                rim: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords],
            effects: { reverb: { wetDry: 0.2, roomSize: 0.35, bypass: false }, delay: { wetDry: 0, bypass: true }, chorus: { wetDry: 0.08, bypass: false }, distortion: { amount: 0, bypass: true } }
        };
    }

    static _summerPop() {
        // C - G - Am - F
        const chords = [
            ...SongTemplates._chordBar(48, [0,4,7], 0, 4, 0.6),
            ...SongTemplates._chordBar(55, [0,4,7], 4, 4, 0.6),
            ...SongTemplates._chordBar(57, [0,3,7], 8, 4, 0.6),
            ...SongTemplates._chordBar(53, [0,4,7], 12, 4, 0.6),
        ];
        const melody = [
            { midi: 72, start: 0, duration: 0.5, velocity: 0.75 },
            { midi: 74, start: 0.5, duration: 0.5, velocity: 0.7 },
            { midi: 76, start: 1, duration: 1, velocity: 0.8 },
            { midi: 74, start: 2.5, duration: 0.5, velocity: 0.65 },
            { midi: 72, start: 3, duration: 1, velocity: 0.7 },
            { midi: 71, start: 4.5, duration: 0.5, velocity: 0.7 },
            { midi: 72, start: 5, duration: 1.5, velocity: 0.75 },
            { midi: 69, start: 8, duration: 1, velocity: 0.7 },
            { midi: 72, start: 9, duration: 0.5, velocity: 0.65 },
            { midi: 74, start: 10, duration: 2, velocity: 0.75 },
            { midi: 72, start: 12, duration: 1, velocity: 0.7 },
            { midi: 69, start: 13, duration: 1, velocity: 0.65 },
            { midi: 67, start: 14.5, duration: 1.5, velocity: 0.7 },
        ];
        return {
            name: 'Summer Pop', category: 'Pop', bpm: 120, key: 0, scale: 'major', swing: 0,
            description: 'Bright pop anthem with classic I-V-vi-IV progression',
            synthPreset: {
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'sawtooth', octave: 0, detune: 12, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 6000, Q: 1 },
                filterEnv: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3, amount: 3000 },
                ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                glide: 0, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null],
                snare: [null,null,null,null, 0.8,null,null,null, null,null,null,null, 0.8,null,null,null],
                hihatC: [0.6,null,0.6,null, 0.6,null,0.6,null, 0.6,null,0.6,null, 0.6,null,0.6,null],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                clap: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                rim: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords, ...melody],
            effects: { reverb: { wetDry: 0.15, roomSize: 0.3, bypass: false }, delay: { wetDry: 0.08, feedback: 0.2, bypass: false }, chorus: { wetDry: 0.1, bypass: false }, distortion: { amount: 0, bypass: true } }
        };
    }

    static _lateNightRnB() {
        // Bbm7 - Eb7 - Abmaj7 - Db
        const chords = [
            ...SongTemplates._chordBar(46, [0,3,7,10], 0, 4, 0.5),
            ...SongTemplates._chordBar(51, [0,4,7,10], 4, 4, 0.5),
            ...SongTemplates._chordBar(56, [0,4,7,11], 8, 4, 0.5),
            ...SongTemplates._chordBar(49, [0,4,7], 12, 4, 0.5),
        ];
        return {
            name: 'Late Night R&B', category: 'R&B / Soul', bpm: 92, key: 10, scale: 'minor', swing: 15,
            description: 'Smooth R&B with silky chords and ghost notes',
            synthPreset: {
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.5 },
                osc2: { type: 'sawtooth', octave: 0, detune: 8, gain: 0.4 },
                filter: { type: 'lowpass', frequency: 2800, Q: 1 },
                filterEnv: { attack: 0.05, decay: 0.4, sustain: 0.4, release: 0.6, amount: 1500 },
                ampEnv: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.6 },
                lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
                glide: 0, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.8,null,null,null, null,null,0.6,null, null,null,null,null, 0.7,null,null,null],
                snare: [null,null,null,null, 0.7,null,null,null, null,null,null,null, 0.7,null,null,0.3],
                hihatC: [0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                clap: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                rim: [null,null,0.3,null, null,null,null,null, null,null,0.3,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords],
            effects: { reverb: { wetDry: 0.25, roomSize: 0.45, bypass: false }, delay: { wetDry: 0.12, feedback: 0.25, bypass: false }, chorus: { wetDry: 0.12, bypass: false }, distortion: { amount: 0, bypass: true } }
        };
    }

    static _epicOrchestral() {
        // Dm - Bb - C - Am
        const chords = [
            ...SongTemplates._chordBar(50, [0,3,7], 0, 4, 0.7),
            ...SongTemplates._chordBar(46, [0,4,7], 4, 4, 0.7),
            ...SongTemplates._chordBar(48, [0,4,7], 8, 4, 0.7),
            ...SongTemplates._chordBar(45, [0,3,7], 12, 4, 0.7),
        ];
        // Double octave for power
        const power = [
            ...SongTemplates._chordBar(38, [0,7,12], 0, 4, 0.6),
            ...SongTemplates._chordBar(34, [0,7,12], 4, 4, 0.6),
            ...SongTemplates._chordBar(36, [0,7,12], 8, 4, 0.6),
            ...SongTemplates._chordBar(33, [0,7,12], 12, 4, 0.6),
        ];
        return {
            name: 'Epic Orchestral', category: 'Cinematic', bpm: 140, key: 2, scale: 'minor', swing: 0,
            description: 'Dramatic orchestral power with wide strings and heavy reverb',
            synthPreset: {
                osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'sawtooth', octave: 0, detune: 10, gain: 0.5 },
                filter: { type: 'lowpass', frequency: 5000, Q: 1 },
                filterEnv: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 1.0, amount: 3000 },
                ampEnv: { attack: 0.15, decay: 0.3, sustain: 0.8, release: 1.5 },
                lfo: { type: 'sine', rate: 5, depth: 0.08, destination: 'pitch' },
                glide: 0, masterGain: 0.3
            },
            drumPattern: {
                kick: [0.9,null,null,null, null,null,null,null, 0.9,null,null,null, null,null,null,null],
                snare: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                hihatC: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                clap: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                rim: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,0.6,0.5],
                cymbal: [0.7,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords, ...power],
            effects: { reverb: { wetDry: 0.5, roomSize: 0.85, bypass: false }, delay: { wetDry: 0.15, feedback: 0.3, bypass: false }, chorus: { wetDry: 0.15, bypass: false }, distortion: { amount: 0.05, wetDry: 0.2, bypass: false } }
        };
    }

    static _ambientDrift() {
        const chords = [
            ...SongTemplates._chordBar(57, [0,2,7], 0, 8, 0.35),    // Am sus2
            ...SongTemplates._chordBar(53, [0,4,7,11], 8, 8, 0.35), // Fmaj7
        ];
        const melody = [
            { midi: 76, start: 1, duration: 3, velocity: 0.3 },
            { midi: 74, start: 5, duration: 2, velocity: 0.25 },
            { midi: 72, start: 9, duration: 4, velocity: 0.3 },
            { midi: 69, start: 14, duration: 2, velocity: 0.25 },
        ];
        return {
            name: 'Ambient Drift', category: 'Cinematic', bpm: 70, key: 9, scale: 'major', swing: 0,
            description: 'Ethereal ambient with no drums, long pads, and slow evolving melody',
            synthPreset: {
                osc1: { type: 'sine', octave: 0, detune: 0, gain: 0.6 },
                osc2: { type: 'triangle', octave: 1, detune: 3, gain: 0.25 },
                filter: { type: 'lowpass', frequency: 3500, Q: 0.5 },
                filterEnv: { attack: 0.5, decay: 1.0, sustain: 0.6, release: 3.0, amount: 1500 },
                ampEnv: { attack: 0.8, decay: 1.0, sustain: 0.7, release: 3.0 },
                lfo: { type: 'sine', rate: 0.3, depth: 0.15, destination: 'filter' },
                glide: 0.1, masterGain: 0.3
            },
            drumPattern: {
                kick: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                snare: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                hihatC: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                hihatO: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                clap: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                rim: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                tom: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
                cymbal: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
            },
            notes: [...chords, ...melody],
            effects: { reverb: { wetDry: 0.65, roomSize: 0.9, bypass: false }, delay: { wetDry: 0.3, feedback: 0.4, bypass: false }, chorus: { wetDry: 0.2, bypass: false }, distortion: { amount: 0, bypass: true } }
        };
    }
}
