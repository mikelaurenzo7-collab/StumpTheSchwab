/**
 * NOVA DAW — MusicBrain
 * Algorithmic music intelligence engine.
 * Pure rule-based: chord progressions, melodies, basslines, drum patterns, mood parameters.
 * No API calls — all music theory computed locally.
 */

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const SCALES = {
    major:      [0,2,4,5,7,9,11],
    minor:      [0,2,3,5,7,8,10],
    dorian:     [0,2,3,5,7,9,10],
    mixolydian: [0,2,4,5,7,9,10],
    pentatonic: [0,2,4,7,9],
    blues:      [0,3,5,6,7,10]
};

// Chord quality intervals from root
const CHORD_TYPES = {
    maj:    [0,4,7],
    min:    [0,3,7],
    dim:    [0,3,6],
    aug:    [0,4,8],
    maj7:   [0,4,7,11],
    min7:   [0,3,7,10],
    dom7:   [0,4,7,10],
    sus2:   [0,2,7],
    sus4:   [0,5,7],
    add9:   [0,4,7,14],
    min9:   [0,3,7,10,14],
    dim7:   [0,3,6,9]
};

// Scale degree → chord quality for each scale type
const DIATONIC_CHORDS = {
    major:  ['maj','min','min','maj','maj','min','dim'],
    minor:  ['min','dim','maj','min','min','maj','maj'],
    dorian: ['min','min','maj','maj','min','dim','maj'],
    mixolydian: ['maj','min','dim','maj','min','min','maj']
};

// Mood → progression templates (as scale degree arrays, 0-indexed)
const MOOD_PROGRESSIONS = {
    happy: [
        [0,4,5,3], [0,3,4,0], [0,5,3,4], [0,4,2,4],
        [0,0,3,4], [0,2,5,4]
    ],
    sad: [
        [5,3,0,4], [0,3,4,5], [0,5,6,4], [0,3,6,4],
        [5,4,0,0], [0,6,5,3]
    ],
    dark: [
        [0,3,4,0], [0,5,6,4], [0,3,6,0], [0,6,5,4],
        [0,4,3,4], [0,3,4,6]
    ],
    epic: [
        [0,4,5,3], [0,4,5,2,3,0,3,4], [0,5,3,4],
        [0,2,5,4], [0,3,4,5]
    ],
    chill: [
        [0,5,1,4], [0,2,5,3], [0,3,1,4], [0,5,2,4],
        [0,3,5,1]
    ],
    aggressive: [
        [0,6,5,4], [0,4,6,0], [0,5,3,0], [0,6,4,5],
        [0,3,5,6]
    ],
    dreamy: [
        [0,3,5,4], [0,2,5,3], [0,5,1,4], [0,4,2,5],
        [0,3,1,5]
    ],
    nostalgic: [
        [0,4,5,3], [0,2,5,4], [0,5,3,4], [0,3,4,0],
        [0,4,1,5]
    ]
};

// Mood → preferred chord extensions
const MOOD_EXTENSIONS = {
    happy: ['maj', 'maj', 'min', 'maj'],
    sad: ['min7', 'min', 'maj', 'min7'],
    dark: ['min', 'min7', 'dim', 'min'],
    epic: ['maj', 'sus4', 'min', 'maj'],
    chill: ['maj7', 'min7', 'dom7', 'maj7'],
    aggressive: ['min', 'maj', 'min', 'maj'],
    dreamy: ['sus2', 'maj7', 'min7', 'sus4'],
    nostalgic: ['maj7', 'min7', 'dom7', 'maj7']
};

// Seedable PRNG for reproducible generation
class SeededRandom {
    constructor(seed = Date.now()) {
        this.state = seed;
    }
    next() {
        this.state = (this.state * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (this.state >>> 0) / 0xFFFFFFFF;
    }
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    pick(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }
}

export default class MusicBrain {

    // ═══════════════════════════════════════════════════════════════
    //  1. CHORD PROGRESSION GENERATOR
    // ═══════════════════════════════════════════════════════════════

    static generateChords(key = 0, scale = 'minor', mood = 'chill', bars = 4) {
        const rng = new SeededRandom(Date.now());
        const scaleIntervals = SCALES[scale] || SCALES.minor;
        const progressions = MOOD_PROGRESSIONS[mood] || MOOD_PROGRESSIONS.chill;
        const extensions = MOOD_EXTENSIONS[mood] || MOOD_EXTENSIONS.chill;

        // Pick a progression template
        const template = rng.pick(progressions);
        const chords = [];
        const chordsPerBar = 1; // One chord per bar for clean feel
        const beatsPerChord = 4 / chordsPerBar;

        for (let bar = 0; bar < bars; bar++) {
            const degreeIdx = template[bar % template.length];
            const degree = degreeIdx % scaleIntervals.length;
            const rootOffset = scaleIntervals[degree];
            const root = (key + rootOffset) % 12;

            // Choose chord quality based on mood
            const quality = extensions[bar % extensions.length];
            const intervals = CHORD_TYPES[quality] || CHORD_TYPES.min;

            // Build voicing: root in octave 3, upper notes in octave 4-5
            const rootMidi = 48 + root; // C3 = 48
            const notes = [rootMidi];

            for (let i = 1; i < intervals.length; i++) {
                let noteMidi = rootMidi + intervals[i];
                // Spread voicing: move some notes up an octave for openness
                if (i >= 2 && rng.next() > 0.4) {
                    noteMidi += 12;
                }
                notes.push(noteMidi);
            }

            chords.push({
                root,
                rootMidi,
                notes,
                name: NOTE_NAMES[root] + (quality === 'maj' ? '' : quality),
                quality,
                degree: degreeIdx,
                start: bar * beatsPerChord,
                duration: beatsPerChord,
                bar
            });
        }

        return chords;
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. MELODY GENERATOR
    // ═══════════════════════════════════════════════════════════════

    static generateMelody(chords = [], scale = 'minor', key = 0, density = 'medium', bars = 4) {
        const rng = new SeededRandom(Date.now() + 1);
        const scaleNotes = MusicBrain.getScaleNotes(key, scale, 60, 84); // C4 to C6
        if (scaleNotes.length === 0) return [];

        const notes = [];
        const stepsPerBar = 16;

        // Density → note lengths and rest probability
        const config = {
            sparse:  { minDur: 0.5,  maxDur: 2,    restChance: 0.4, notesPerBar: 3  },
            medium:  { minDur: 0.25, maxDur: 1,    restChance: 0.25, notesPerBar: 6 },
            dense:   { minDur: 0.125,maxDur: 0.5,  restChance: 0.15, notesPerBar: 10 }
        };
        const cfg = config[density] || config.medium;

        let currentPitch = rng.pick(scaleNotes);
        let beat = 0;
        const totalBeats = bars * 4;

        while (beat < totalBeats) {
            // Rest?
            if (rng.next() < cfg.restChance) {
                beat += cfg.minDur;
                continue;
            }

            // Find current chord
            const chord = chords.find(c => beat >= c.start && beat < c.start + c.duration) || chords[0];

            // Strong beats target chord tones
            const isStrongBeat = Math.abs(beat % 1) < 0.01;
            let targetPitch;

            if (isStrongBeat && chord && rng.next() > 0.3) {
                // Target a chord tone
                const chordTones = chord.notes.filter(n => n >= 60 && n <= 84);
                if (chordTones.length > 0) {
                    targetPitch = rng.pick(chordTones);
                } else {
                    targetPitch = MusicBrain._nearestScaleNote(currentPitch, scaleNotes);
                }
            } else {
                // Stepwise motion in scale
                const currentIdx = MusicBrain._closestIndex(currentPitch, scaleNotes);
                const step = rng.nextInt(-2, 2);
                const newIdx = Math.max(0, Math.min(scaleNotes.length - 1, currentIdx + step));
                targetPitch = scaleNotes[newIdx];
            }

            // Avoid large leaps
            if (Math.abs(targetPitch - currentPitch) > 7) {
                const dir = targetPitch > currentPitch ? 1 : -1;
                const idx = MusicBrain._closestIndex(currentPitch, scaleNotes);
                const newIdx = Math.max(0, Math.min(scaleNotes.length - 1, idx + dir * 2));
                targetPitch = scaleNotes[newIdx];
            }

            // Occasional chromatic approach from below
            let finalPitch = targetPitch;
            if (!isStrongBeat && rng.next() > 0.85) {
                finalPitch = targetPitch - 1; // semitone below
            }

            const duration = cfg.minDur + rng.next() * (cfg.maxDur - cfg.minDur);
            const quantizedDur = Math.round(duration / 0.125) * 0.125 || 0.125;

            // Velocity: stronger on downbeats
            const velocity = isStrongBeat
                ? 0.7 + rng.next() * 0.3
                : 0.45 + rng.next() * 0.3;

            notes.push({
                midi: finalPitch,
                start: Math.round(beat * 1000) / 1000,
                duration: Math.min(quantizedDur, totalBeats - beat),
                velocity: Math.round(velocity * 100) / 100
            });

            currentPitch = targetPitch;
            beat += quantizedDur;
        }

        return notes;
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. BASSLINE GENERATOR
    // ═══════════════════════════════════════════════════════════════

    static generateBassline(chords = [], genre = 'pop', key = 0) {
        const rng = new SeededRandom(Date.now() + 2);
        const notes = [];
        if (chords.length === 0) return notes;

        for (const chord of chords) {
            const root = 36 + chord.root; // C2 = 36
            const fifth = root + 7;
            const octave = root + 12;
            const start = chord.start;
            const dur = chord.duration;

            switch (genre) {
                case 'trap':
                case 'drill':
                    // Long sustained root notes
                    notes.push({ midi: root, start, duration: dur * 0.9, velocity: 0.9 });
                    if (rng.next() > 0.5) {
                        notes.push({ midi: root - 12, start: start + dur * 0.75, duration: dur * 0.2, velocity: 0.7 });
                    }
                    break;

                case 'house':
                case 'dnb':
                    // Driving octave pattern
                    for (let i = 0; i < 4; i++) {
                        const t = start + (dur / 4) * i;
                        const pitch = i === 2 ? fifth : root;
                        notes.push({ midi: pitch, start: t, duration: dur / 8, velocity: 0.75 + (i === 0 ? 0.15 : 0) });
                    }
                    break;

                case 'boombap':
                case 'lofi':
                    // Walking bass with chromatic approach
                    notes.push({ midi: root, start, duration: dur * 0.45, velocity: 0.8 });
                    const walkNote = rng.next() > 0.5 ? fifth : root + 5;
                    notes.push({ midi: walkNote, start: start + dur * 0.5, duration: dur * 0.2, velocity: 0.6 });
                    // Chromatic approach to next chord
                    if (rng.next() > 0.4) {
                        notes.push({ midi: root + (rng.next() > 0.5 ? 1 : -1), start: start + dur * 0.8, duration: dur * 0.15, velocity: 0.5 });
                    }
                    break;

                case 'rnb':
                    // Smooth bass with 7ths
                    notes.push({ midi: root, start, duration: dur * 0.6, velocity: 0.75 });
                    const seventh = root + 10;
                    notes.push({ midi: seventh, start: start + dur * 0.65, duration: dur * 0.2, velocity: 0.55 });
                    break;

                default: // pop
                    // Simple root-fifth
                    notes.push({ midi: root, start, duration: dur * 0.45, velocity: 0.8 });
                    notes.push({ midi: fifth, start: start + dur * 0.5, duration: dur * 0.4, velocity: 0.65 });
                    break;
            }
        }

        return notes;
    }

    // ═══════════════════════════════════════════════════════════════
    //  4. DRUM PATTERN GENERATOR
    // ═══════════════════════════════════════════════════════════════

    static generateDrumPattern(genre = 'trap', complexity = 3, variation = 0) {
        const rng = new SeededRandom(Date.now() + variation * 99999);
        const pattern = {
            kick: new Array(16).fill(null),
            snare: new Array(16).fill(null),
            hihatC: new Array(16).fill(null),
            hihatO: new Array(16).fill(null),
            clap: new Array(16).fill(null),
            rim: new Array(16).fill(null),
            tom: new Array(16).fill(null),
            cymbal: new Array(16).fill(null)
        };

        const templates = MusicBrain._drumTemplates();
        const base = templates[genre] || templates.pop;

        // Apply base pattern
        for (const [sound, steps] of Object.entries(base)) {
            if (!pattern[sound]) continue;
            for (let i = 0; i < 16; i++) {
                if (steps[i]) {
                    pattern[sound][i] = steps[i];
                }
            }
        }

        // Add variation
        if (variation > 0) {
            for (const sound of Object.keys(pattern)) {
                for (let i = 0; i < 16; i++) {
                    if (rng.next() < variation * 0.15) {
                        // Randomly toggle steps
                        if (pattern[sound][i]) {
                            pattern[sound][i] = null;
                        } else if (rng.next() < 0.3) {
                            pattern[sound][i] = 0.3 + rng.next() * 0.5;
                        }
                    }
                }
            }
        }

        // Add complexity layers
        if (complexity >= 2) {
            // Ghost hats
            for (let i = 0; i < 16; i++) {
                if (!pattern.hihatC[i] && rng.next() < 0.3) {
                    pattern.hihatC[i] = 0.2 + rng.next() * 0.2;
                }
            }
        }
        if (complexity >= 3) {
            // Rim ghost notes
            for (let i = 0; i < 16; i++) {
                if (!pattern.rim[i] && rng.next() < 0.15) {
                    pattern.rim[i] = 0.2 + rng.next() * 0.3;
                }
            }
        }
        if (complexity >= 4) {
            // Tom fills (last 2 steps)
            if (rng.next() > 0.4) {
                pattern.tom[14] = 0.6;
                pattern.tom[15] = 0.5;
            }
            // Open hat accents
            if (rng.next() > 0.5) {
                const pos = rng.nextInt(4, 14);
                pattern.hihatO[pos] = 0.6;
            }
        }
        if (complexity >= 5) {
            // Hi-hat rolls (rapid 32nd-note feel via alternating velocities)
            const rollStart = rng.nextInt(8, 14);
            for (let i = rollStart; i < 16; i++) {
                pattern.hihatC[i] = 0.3 + rng.next() * 0.5;
            }
            // Cymbal crash on beat 1
            pattern.cymbal[0] = 0.7;
        }

        return pattern;
    }

    static _drumTemplates() {
        return {
            trap: {
                kick:   [0.9, null, null, null, null, null, 0.8, null, null, null, 0.7, null, 0.9, null, null, null],
                snare:  [null,null,null,null, 0.9,null,null,null, null,null,null,null, 0.9,null,null,null],
                hihatC: [0.8,0.4,0.7,0.4, 0.8,0.4,0.8,0.5, 0.8,0.5,0.8,0.4, 0.8,0.5,0.9,0.5],
                clap:   [null,null,null,null, 0.8,null,null,null, null,null,null,null, 0.8,null,null,null]
            },
            house: {
                kick:   [0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null],
                clap:   [null,null,null,null, 0.9,null,null,null, null,null,null,null, 0.9,null,null,null],
                hihatC: [0.6,null,0.7,null, 0.6,null,0.7,null, 0.6,null,0.7,null, 0.6,null,0.7,null],
                hihatO: [null,null,null,null, null,null,null,0.5, null,null,null,null, null,null,null,0.5]
            },
            boombap: {
                kick:   [0.9,null,null,null, null,null,null,null, null,0.7,null,null, null,null,0.8,null],
                snare:  [null,null,null,null, 0.9,null,null,null, null,null,null,null, 0.9,null,null,null],
                hihatC: [0.7,null,0.5,null, 0.7,null,0.5,null, 0.7,null,0.5,null, 0.7,null,0.5,null]
            },
            rnb: {
                kick:   [0.8,null,null,null, null,null,0.6,null, null,null,null,null, 0.7,null,null,null],
                snare:  [null,null,null,null, 0.7,null,null,null, null,null,null,null, 0.7,null,null,0.3],
                hihatC: [0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3],
                rim:    [null,null,0.4,null, null,null,null,null, null,null,0.4,null, null,null,null,null]
            },
            drill: {
                kick:   [0.9,null,null,0.7, null,null,0.8,null, 0.9,null,null,0.7, null,null,0.6,null],
                snare:  [null,null,null,null, 0.9,null,null,null, null,null,null,null, 0.9,null,null,null],
                hihatC: [0.9,0.4,0.7,0.4, 0.9,0.4,0.7,0.5, 0.9,0.4,0.8,0.4, 0.9,0.5,0.8,0.5]
            },
            lofi: {
                kick:   [0.7,null,null,null, null,null,null,null, null,0.5,null,null, null,null,null,null],
                snare:  [null,null,null,null, 0.6,null,null,null, null,null,null,null, 0.6,null,null,null],
                hihatC: [0.4,null,0.3,null, 0.4,null,0.3,null, 0.4,null,0.3,null, 0.4,null,0.3,null]
            },
            pop: {
                kick:   [0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null, 0.9,null,null,null],
                snare:  [null,null,null,null, 0.8,null,null,null, null,null,null,null, 0.8,null,null,null],
                hihatC: [0.6,null,0.6,null, 0.6,null,0.6,null, 0.6,null,0.6,null, 0.6,null,0.6,null]
            },
            dnb: {
                kick:   [0.9,null,null,null, null,null,null,null, null,null,0.8,null, null,null,null,null],
                snare:  [null,null,null,null, 0.9,null,null,null, null,null,null,null, null,null,0.9,null],
                hihatC: [0.7,0.5,0.7,0.5, 0.7,0.5,0.7,0.5, 0.7,0.5,0.7,0.5, 0.7,0.5,0.7,0.5]
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  5. MOOD PARAMETER ENGINE
    // ═══════════════════════════════════════════════════════════════

    static getMoodParams(mood = 'chill', intensity = 0.5) {
        const moods = {
            happy:      { filterFrequency: 5000, filterQ: 1,  ampAttack: 0.01, ampRelease: 0.3, lfoRate: 0, lfoDepth: 0, reverbWet: 0.15, reverbSize: 0.3, delayWet: 0.1, delayFeedback: 0.2, distortionAmount: 0, chorusWet: 0.1, bpmMin: 110, bpmMax: 135, bpmSuggested: 120 },
            sad:        { filterFrequency: 1200, filterQ: 2,  ampAttack: 0.1,  ampRelease: 0.8, lfoRate: 2, lfoDepth: 0.3, reverbWet: 0.4, reverbSize: 0.6, delayWet: 0.2, delayFeedback: 0.35, distortionAmount: 0, chorusWet: 0.15, bpmMin: 60, bpmMax: 90, bpmSuggested: 75 },
            dark:       { filterFrequency: 600,  filterQ: 4,  ampAttack: 0.05, ampRelease: 0.5, lfoRate: 1, lfoDepth: 0.4, reverbWet: 0.45, reverbSize: 0.7, delayWet: 0.15, delayFeedback: 0.4, distortionAmount: 0.2, chorusWet: 0, bpmMin: 70, bpmMax: 100, bpmSuggested: 85 },
            epic:       { filterFrequency: 8000, filterQ: 1,  ampAttack: 0.05, ampRelease: 0.6, lfoRate: 0, lfoDepth: 0, reverbWet: 0.5, reverbSize: 0.8, delayWet: 0.2, delayFeedback: 0.3, distortionAmount: 0.1, chorusWet: 0.2, bpmMin: 120, bpmMax: 160, bpmSuggested: 140 },
            chill:      { filterFrequency: 2500, filterQ: 1.5,ampAttack: 0.08, ampRelease: 0.5, lfoRate: 0.5, lfoDepth: 0.1, reverbWet: 0.3, reverbSize: 0.5, delayWet: 0.15, delayFeedback: 0.25, distortionAmount: 0, chorusWet: 0.15, bpmMin: 75, bpmMax: 100, bpmSuggested: 85 },
            aggressive: { filterFrequency: 4000, filterQ: 5,  ampAttack: 0.001,ampRelease: 0.2, lfoRate: 0, lfoDepth: 0, reverbWet: 0.1, reverbSize: 0.2, delayWet: 0.05, delayFeedback: 0.1, distortionAmount: 0.5, chorusWet: 0, bpmMin: 130, bpmMax: 175, bpmSuggested: 150 },
            dreamy:     { filterFrequency: 3000, filterQ: 1,  ampAttack: 0.3,  ampRelease: 1.5, lfoRate: 0.8, lfoDepth: 0.2, reverbWet: 0.6, reverbSize: 0.9, delayWet: 0.3, delayFeedback: 0.4, distortionAmount: 0, chorusWet: 0.3, bpmMin: 60, bpmMax: 90, bpmSuggested: 72 },
            nostalgic:  { filterFrequency: 2000, filterQ: 2,  ampAttack: 0.05, ampRelease: 0.6, lfoRate: 1.5, lfoDepth: 0.15, reverbWet: 0.35, reverbSize: 0.5, delayWet: 0.2, delayFeedback: 0.3, distortionAmount: 0.05, chorusWet: 0.2, bpmMin: 80, bpmMax: 110, bpmSuggested: 95 }
        };

        const m = moods[mood] || moods.chill;
        const t = Math.max(0, Math.min(1, intensity));

        // Interpolate toward mood values based on intensity
        return {
            synth: {
                filterFrequency: Math.round(m.filterFrequency * (0.5 + t * 0.5)),
                filterQ: m.filterQ * t,
                ampAttack: m.ampAttack,
                ampRelease: m.ampRelease * (0.5 + t * 0.5),
                lfoRate: m.lfoRate * t,
                lfoDepth: m.lfoDepth * t
            },
            effects: {
                reverbWet: m.reverbWet * t,
                reverbSize: m.reverbSize,
                delayWet: m.delayWet * t,
                delayFeedback: m.delayFeedback,
                distortionAmount: m.distortionAmount * t,
                chorusWet: m.chorusWet * t
            },
            bpmRange: {
                min: m.bpmMin,
                max: m.bpmMax,
                suggested: m.bpmSuggested
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  UTILITY METHODS
    // ═══════════════════════════════════════════════════════════════

    static getScaleNotes(key, scaleName, lowMidi = 36, highMidi = 96) {
        const intervals = SCALES[scaleName] || SCALES.minor;
        const notes = [];
        for (let midi = lowMidi; midi <= highMidi; midi++) {
            const degree = ((midi % 12) - key + 12) % 12;
            if (intervals.includes(degree)) {
                notes.push(midi);
            }
        }
        return notes;
    }

    static isChordTone(midi, chord) {
        if (!chord || !chord.notes) return false;
        const pitchClass = midi % 12;
        return chord.notes.some(n => n % 12 === pitchClass);
    }

    static getChordName(notes) {
        if (!notes || notes.length === 0) return '';
        const root = notes[0] % 12;
        const intervals = notes.map(n => ((n % 12) - root + 12) % 12).sort((a, b) => a - b);
        const key = intervals.join(',');

        const names = {
            '0,4,7': 'maj', '0,3,7': 'min', '0,3,6': 'dim', '0,4,8': 'aug',
            '0,4,7,11': 'maj7', '0,3,7,10': 'min7', '0,4,7,10': '7',
            '0,2,7': 'sus2', '0,5,7': 'sus4'
        };

        return NOTE_NAMES[root] + (names[key] || '');
    }

    static _nearestScaleNote(midi, scaleNotes) {
        let closest = scaleNotes[0];
        let minDist = Math.abs(midi - closest);
        for (const note of scaleNotes) {
            const dist = Math.abs(midi - note);
            if (dist < minDist) {
                minDist = dist;
                closest = note;
            }
        }
        return closest;
    }

    // ═══════════════════════════════════════════════════════════════
    //  6. AI SOUND DESIGNER — Natural Language → Synth Parameters
    // ═══════════════════════════════════════════════════════════════

    static designSound(description) {
        const desc = description.toLowerCase();
        const has = (word) => desc.includes(word);

        // Start with neutral init patch
        const patch = {
            osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.8 },
            osc2: { type: 'square', octave: 0, detune: 7, gain: 0.0 },
            filter: { type: 'lowpass', frequency: 3000, Q: 1 },
            filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3, amount: 2000 },
            ampEnv: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.3 },
            lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
            glide: 0,
            masterGain: 0.3
        };

        const effects = {
            reverb: { wetDry: 0, roomSize: 0.3, bypass: true },
            delay: { wetDry: 0, feedback: 0.2, bypass: true },
            chorus: { wetDry: 0, rate: 1.5, depth: 0.5, bypass: true },
            distortion: { amount: 0, wetDry: 0, bypass: true }
        };

        const matched = [];

        // ── Tonal character ──
        if (has('warm') || has('lush') || has('rich')) {
            patch.osc1.type = 'sawtooth';
            patch.osc2.gain = 0.4;
            patch.osc2.detune = 12;
            patch.filter.frequency = 4500;
            patch.filter.Q = 0.8;
            matched.push('warm');
        }
        if (has('bright') || has('crisp') || has('brilliant')) {
            patch.filter.frequency = 8000;
            patch.filter.Q = 1.5;
            patch.filterEnv.amount = 5000;
            patch.ampEnv.attack = 0.005;
            matched.push('bright');
        }
        if (has('dark') || has('deep') || has('murky')) {
            patch.filter.frequency = 600;
            patch.filter.Q = 3;
            patch.osc1.type = 'sawtooth';
            patch.filterEnv.amount = 800;
            effects.reverb.wetDry = 0.3;
            effects.reverb.bypass = false;
            matched.push('dark');
        }
        if (has('thin') || has('narrow') || has('nasal')) {
            patch.filter.type = 'bandpass';
            patch.filter.frequency = 1500;
            patch.filter.Q = 8;
            matched.push('thin');
        }

        // ── Instrument type ──
        if (has('pad') || has('atmosphere') || has('ambient')) {
            patch.ampEnv.attack = 0.5;
            patch.ampEnv.decay = 1.0;
            patch.ampEnv.sustain = 0.8;
            patch.ampEnv.release = 2.0;
            patch.filterEnv.attack = 0.3;
            effects.reverb.wetDry = 0.4;
            effects.reverb.roomSize = 0.7;
            effects.reverb.bypass = false;
            effects.chorus.wetDry = 0.2;
            effects.chorus.bypass = false;
            matched.push('pad');
        }
        if (has('bass') || has('sub') || has('low')) {
            patch.osc1.octave = -1;
            patch.osc2.octave = -1;
            patch.filter.frequency = 300;
            patch.filterEnv.amount = 500;
            patch.ampEnv.decay = 0.4;
            patch.ampEnv.sustain = 0.6;
            matched.push('bass');
        }
        if (has('lead') || has('solo') || has('melody')) {
            patch.filter.frequency = 5000;
            patch.osc2.gain = 0.3;
            patch.osc2.detune = 5;
            patch.ampEnv.attack = 0.01;
            patch.glide = 0.05;
            matched.push('lead');
        }
        if (has('pluck') || has('stab') || has('hit')) {
            patch.ampEnv.attack = 0.001;
            patch.ampEnv.decay = 0.2;
            patch.ampEnv.sustain = 0.0;
            patch.ampEnv.release = 0.15;
            patch.filterEnv.attack = 0.001;
            patch.filterEnv.decay = 0.15;
            patch.filterEnv.sustain = 0.0;
            patch.filterEnv.amount = 6000;
            matched.push('pluck');
        }
        if (has('key') || has('piano') || has('organ') || has('electric piano') || has('ep')) {
            patch.osc1.type = 'sine';
            patch.osc2.type = 'triangle';
            patch.osc2.gain = 0.3;
            patch.ampEnv.attack = 0.005;
            patch.ampEnv.decay = 0.5;
            patch.ampEnv.sustain = 0.3;
            matched.push('keys');
        }
        if (has('bell') || has('chime') || has('metallic')) {
            patch.osc1.type = 'sine';
            patch.osc2.type = 'sine';
            patch.osc2.octave = 1;
            patch.osc2.gain = 0.5;
            patch.osc2.detune = 1;
            patch.ampEnv.decay = 1.5;
            patch.ampEnv.sustain = 0.0;
            patch.filter.frequency = 6000;
            matched.push('bell');
        }
        if (has('string') || has('violin') || has('cello')) {
            patch.osc1.type = 'sawtooth';
            patch.osc2.type = 'sawtooth';
            patch.osc2.gain = 0.5;
            patch.osc2.detune = 8;
            patch.ampEnv.attack = 0.15;
            patch.ampEnv.release = 0.8;
            patch.lfo.rate = 5;
            patch.lfo.depth = 0.1;
            patch.lfo.destination = 'pitch';
            matched.push('strings');
        }

        // ── Era/style ──
        if (has('80s') || has('retro') || has('synthwave') || has('vapor')) {
            patch.osc1.type = 'sawtooth';
            patch.osc2.type = 'square';
            patch.osc2.gain = 0.4;
            patch.osc2.detune = 10;
            effects.chorus.wetDry = 0.3;
            effects.chorus.bypass = false;
            effects.delay.wetDry = 0.15;
            effects.delay.feedback = 0.3;
            effects.delay.bypass = false;
            matched.push('80s');
        }
        if (has('lo-fi') || has('lofi') || has('vintage') || has('tape')) {
            patch.filter.frequency = 2000;
            patch.filter.Q = 0.5;
            effects.chorus.wetDry = 0.1;
            effects.chorus.bypass = false;
            matched.push('lofi');
        }
        if (has('futuristic') || has('cyber') || has('digital') || has('glitch')) {
            patch.osc1.type = 'square';
            patch.osc2.type = 'sawtooth';
            patch.filter.Q = 6;
            patch.lfo.rate = 8;
            patch.lfo.depth = 0.3;
            patch.lfo.destination = 'filter';
            effects.delay.wetDry = 0.2;
            effects.delay.bypass = false;
            matched.push('futuristic');
        }

        // ── Texture modifiers ──
        if (has('shimmer') || has('sparkle') || has('glisten')) {
            patch.osc2.octave = 1;
            patch.osc2.gain = 0.25;
            patch.osc2.type = 'triangle';
            effects.reverb.wetDry = 0.5;
            effects.reverb.roomSize = 0.8;
            effects.reverb.bypass = false;
            effects.chorus.wetDry = 0.15;
            effects.chorus.bypass = false;
            matched.push('shimmer');
        }
        if (has('aggressive') || has('harsh') || has('distorted') || has('dirty')) {
            effects.distortion.amount = 0.4;
            effects.distortion.wetDry = 0.5;
            effects.distortion.bypass = false;
            patch.filter.Q = 5;
            patch.ampEnv.attack = 0.001;
            matched.push('aggressive');
        }
        if (has('ethereal') || has('dreamy') || has('floating') || has('airy')) {
            patch.ampEnv.attack = 0.4;
            patch.ampEnv.release = 2.5;
            effects.reverb.wetDry = 0.6;
            effects.reverb.roomSize = 0.9;
            effects.reverb.bypass = false;
            patch.lfo.rate = 0.5;
            patch.lfo.depth = 0.15;
            patch.lfo.destination = 'filter';
            matched.push('ethereal');
        }
        if (has('wobble') || has('dubstep') || has('wub')) {
            patch.lfo.rate = 4;
            patch.lfo.depth = 0.6;
            patch.lfo.destination = 'filter';
            patch.filter.Q = 8;
            patch.filter.frequency = 1500;
            matched.push('wobble');
        }
        if (has('brass') || has('horn') || has('trumpet')) {
            patch.osc1.type = 'sawtooth';
            patch.osc2.type = 'sawtooth';
            patch.osc2.gain = 0.3;
            patch.filter.frequency = 3000;
            patch.filterEnv.amount = 4000;
            patch.filterEnv.attack = 0.03;
            patch.filterEnv.decay = 0.2;
            patch.ampEnv.attack = 0.03;
            matched.push('brass');
        }
        if (has('noise') || has('white noise') || has('wind') || has('texture')) {
            // Simulate noise character with high-frequency content
            patch.osc1.type = 'sawtooth';
            patch.osc2.type = 'square';
            patch.osc2.gain = 0.5;
            patch.osc2.detune = 50;
            patch.filter.type = 'bandpass';
            patch.filter.frequency = 5000;
            patch.filter.Q = 0.5;
            matched.push('noise');
        }
        if (has('wide') || has('stereo') || has('huge') || has('massive')) {
            patch.osc2.gain = 0.6;
            patch.osc2.detune = 15;
            effects.chorus.wetDry = 0.25;
            effects.chorus.bypass = false;
            effects.reverb.wetDry = 0.2;
            effects.reverb.bypass = false;
            matched.push('wide');
        }

        return {
            patch,
            effects,
            matched,
            description: matched.length > 0
                ? `Designed: ${matched.join(' + ')}`
                : 'No descriptors matched — using default patch'
        };
    }

    static _closestIndex(midi, scaleNotes) {
        let idx = 0;
        let minDist = Math.abs(midi - scaleNotes[0]);
        for (let i = 1; i < scaleNotes.length; i++) {
            const dist = Math.abs(midi - scaleNotes[i]);
            if (dist < minDist) {
                minDist = dist;
                idx = i;
            }
        }
        return idx;
    }
}
