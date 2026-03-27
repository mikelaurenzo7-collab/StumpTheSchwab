export default class DrumPatterns {

    static _patterns = [

        // ── Trap ────────────────────────────────────────────────────────

        {
            name: 'Trap Basic',
            genre: 'Trap',
            bpm: 140,
            swing: 0,
            pattern: {
                kick:   [{v:1},  null,  null,  null,  null,  null,  null,  null,  null,  null,  {v:0.9},null,  {v:1},  null,  null,  null],
                snare:  [null,   null,  null,  null,  {v:1}, null,  null,  null,  null,  null,  null,   null,  {v:1},  null,  null,  null],
                hihatC: [{v:0.8},{v:0.5},{v:0.7},{v:0.5},{v:0.8},{v:0.5},{v:0.9},{v:0.5},{v:0.8},{v:0.6},{v:0.9},{v:0.6},{v:0.8},{v:0.7},{v:0.9},{v:0.7}],
                hihatO: [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,   null,  null,   null,  null,  {v:0.6}],
                clap:   [null,   null,  null,  null,  {v:0.9},null, null,  null,  null,  null,  null,   null,  {v:0.9},null,  null,  null],
                rim:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,   null,  null,   null,  null,  null],
                tom:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,   null,  null,   null,  null,  null],
                cymbal: [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,   null,  null,   null,  null,  null]
            }
        },
        {
            name: 'Trap Hard',
            genre: 'Trap',
            bpm: 140,
            swing: 0,
            pattern: {
                kick:   [{v:1},  null,  null,  {v:0.7},null,  null,  {v:0.9},null,  {v:1},  null,  null,  {v:0.8},null,  null,  {v:0.7},null],
                snare:  [null,   null,  null,  null,   {v:1}, null,  null,   null,  null,   null,  null,  null,   {v:1}, null,  null,   null],
                hihatC: [{v:0.9},{v:0.4},{v:0.7},{v:0.4},{v:0.9},{v:0.4},{v:0.7},{v:0.5},{v:0.9},{v:0.4},{v:0.8},{v:0.4},{v:0.9},{v:0.5},{v:0.8},{v:0.5}],
                hihatO: [null,   null,  null,  null,   null,  null,  null,   {v:0.5},null,  null,  null,  null,   null,  null,  null,   {v:0.6}],
                clap:   [null,   null,  null,  null,   {v:1}, null,  null,   null,  null,   null,  null,  null,   {v:1}, null,  null,   null],
                rim:    [null,   null,  {v:0.4},null,  null,  null,  null,   null,  null,   null,  {v:0.4},null,  null,  null,  null,   null],
                tom:    [null,   null,  null,  null,   null,  null,  null,   null,  null,   null,  null,  null,   null,  null,  {v:0.6},{v:0.5}],
                cymbal: [{v:0.6},null,  null,  null,   null,  null,  null,   null,  null,   null,  null,  null,   null,  null,  null,   null]
            }
        },

        // ── House ───────────────────────────────────────────────────────

        {
            name: 'House Classic',
            genre: 'House',
            bpm: 124,
            swing: 0,
            pattern: {
                kick:   [{v:1},  null,  null,  null,  {v:1}, null,  null,  null,  {v:1}, null,  null,  null,  {v:1}, null,  null,  null],
                snare:  [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null],
                hihatC: [{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4}],
                hihatO: [null,   null,  {v:0.6},null,  null,  null,  {v:0.6},null,  null,  null,  {v:0.6},null,  null,  null,  {v:0.6},null],
                clap:   [null,   null,  null,  null,  {v:1}, null,  null,  null,  null,  null,  null,  null,  {v:1}, null,  null,  null],
                rim:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null],
                tom:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null],
                cymbal: [{v:0.5},null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null]
            }
        },
        {
            name: 'Deep House',
            genre: 'House',
            bpm: 124,
            swing: 15,
            pattern: {
                kick:   [{v:1},  null,  null,  null,  {v:0.9},null, null,  null,  {v:1}, null,  null,  null,  {v:0.9},null, null,  null],
                snare:  [null,   null,  null,  {v:0.3},null,  null, null,  {v:0.3},null, null,  null,  {v:0.3},null,  null, null,  {v:0.3}],
                hihatC: [{v:0.5},{v:0.3},{v:0.6},{v:0.3},{v:0.5},{v:0.3},{v:0.6},{v:0.3},{v:0.5},{v:0.3},{v:0.6},{v:0.3},{v:0.5},{v:0.3},{v:0.6},{v:0.3}],
                hihatO: [null,   null,  {v:0.4},null,  null,  null, {v:0.4},null, null,  null,  {v:0.4},null, null,  null, {v:0.4},null],
                clap:   [null,   null,  null,  null,  {v:0.8},null, null,  null,  null,  null,  null,  null,  {v:0.8},null, null,  null],
                rim:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null],
                tom:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null],
                cymbal: [null,   null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null,  null]
            }
        },

        // ── Boom Bap ────────────────────────────────────────────────────

        {
            name: 'Boom Bap Classic',
            genre: 'Boom Bap',
            bpm: 90,
            swing: 60,
            pattern: {
                kick:   [{v:1},  null,  null,  null,  null,  null,  {v:0.9},null,  {v:1}, null,  null,  null,  null,  null,  null,  null],
                snare:  [null,   null,  null,  null,  {v:1}, null,  null,   null,  null,  null,  null,  null,  {v:1}, null,  null,  null],
                hihatC: [{v:0.8},{v:0.5},{v:0.8},{v:0.5},{v:0.8},{v:0.5},{v:0.8},{v:0.5},{v:0.8},{v:0.5},{v:0.8},{v:0.5},{v:0.8},{v:0.5},{v:0.8},{v:0.5}],
                hihatO: [null,   null,  null,  null,  null,  null,  null,   null,  null,  null,  null,  null,  null,  null,  null,  null],
                clap:   [null,   null,  null,  null,  null,  null,  null,   null,  null,  null,  null,  null,  null,  null,  null,  null],
                rim:    [null,   null,  null,  null,  null,  null,  null,   null,  null,  null,  null,  null,  null,  null,  null,  null],
                tom:    [null,   null,  null,  null,  null,  null,  null,   null,  null,  null,  null,  null,  null,  null,  null,  null],
                cymbal: [null,   null,  null,  null,  null,  null,  null,   null,  null,  null,  null,  null,  null,  null,  null,  null]
            }
        },
        {
            name: 'Boom Bap Dusty',
            genre: 'Boom Bap',
            bpm: 90,
            swing: 60,
            pattern: {
                kick:   [{v:1},  null,  null,  null,  null,  null,  null,   null,  {v:0.9},null, null,  {v:0.7},null, null,  null,  null],
                snare:  [null,   null,  null,  null,  {v:1}, null,  null,   null,  null,   null, null,  null,   {v:1},null,  null,  null],
                hihatC: [{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4},{v:0.7},{v:0.4}],
                hihatO: [null,   null,  null,  null,  null,  null,  {v:0.5},null,  null,   null, null,  null,   null, null,  {v:0.5},null],
                clap:   [null,   null,  null,  null,  null,  null,  null,   null,  null,   null, null,  null,   null, null,  null,   null],
                rim:    [null,   null,  {v:0.5},null, null,  null,  null,   {v:0.4},null,  null, {v:0.5},null,  null, null,  null,   {v:0.4}],
                tom:    [null,   null,  null,  null,  null,  null,  null,   null,  null,   null, null,  null,   null, null,  null,   null],
                cymbal: [null,   null,  null,  null,  null,  null,  null,   null,  null,   null, null,  null,   null, null,  null,   null]
            }
        },

        // ── R&B ─────────────────────────────────────────────────────────

        {
            name: 'R&B Smooth',
            genre: 'R&B',
            bpm: 75,
            swing: 40,
            pattern: {
                kick:   [{v:0.9},null,  null,  null,  null,  null,  {v:0.7},null,  {v:0.9},null, null,  null,  null,  null,  null,  null],
                snare:  [null,   null,  null,  {v:0.3},  {v:0.9},null, null,  null,  null,  null, null,  {v:0.3},  {v:0.9},null, null,  {v:0.3}],
                hihatC: [{v:0.6},{v:0.3},{v:0.5},{v:0.3},{v:0.6},{v:0.3},{v:0.5},{v:0.3},{v:0.6},{v:0.3},{v:0.5},{v:0.3},{v:0.6},{v:0.3},{v:0.5},{v:0.3}],
                hihatO: [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  {v:0.4},null],
                clap:   [null,   null,  null,  null,  {v:0.7},null, null,  null,  null,  null, null,  null,  {v:0.7},null, null,  null],
                rim:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  null,  null],
                tom:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  null,  null],
                cymbal: [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  null,  null]
            }
        },
        {
            name: 'R&B Modern',
            genre: 'R&B',
            bpm: 75,
            swing: 50,
            pattern: {
                kick:   [{v:1},  null,  null,  null,  null,  null,  null,  {v:0.8},null, null,  {v:0.9},null, null,  null,  null,  null],
                snare:  [null,   null,  null,  null,  {v:1}, null,  null,  null,   null, null,  null,   null, {v:1}, null,  null,  null],
                hihatC: [{v:0.5},{v:0.3},{v:0.5},{v:0.3},{v:0.5},{v:0.3},{v:0.5},{v:0.3},{v:0.5},{v:0.3},{v:0.5},{v:0.3},{v:0.5},{v:0.3},{v:0.5},{v:0.3}],
                hihatO: [null,   null,  {v:0.4},null, null,  null, {v:0.4},null,  null, null,  {v:0.4},null, null,  null, {v:0.4},null],
                clap:   [null,   null,  null,  null,  {v:0.9},null,null,  null,   null, null,  null,   null, {v:0.9},null,null,  null],
                rim:    [null,   null,  null,  null,  null,  null,  null,  null,   null, null,  null,   null, null,  null,  null,  null],
                tom:    [null,   null,  null,  null,  null,  null,  null,  null,   null, null,  null,   null, null,  null,  null,  null],
                cymbal: [null,   null,  null,  null,  null,  null,  null,  null,   null, null,  null,   null, null,  null,  null,  null]
            }
        },

        // ── Drill ───────────────────────────────────────────────────────

        {
            name: 'UK Drill',
            genre: 'Drill',
            bpm: 140,
            swing: 0,
            pattern: {
                kick:   [{v:1},  null,  null,  {v:0.7},null,  null,  null,  null,  {v:0.9},null, null,  null,  {v:1},  null,  {v:0.6},null],
                snare:  [null,   null,  null,  null,   null,  {v:0.9},null, null,  null,   null, null,  {v:0.8},null,  {v:1}, null,   null],
                hihatC: [{v:0.9},{v:0.5},{v:0.8},{v:0.5},{v:0.9},{v:0.5},{v:0.8},{v:0.6},{v:0.9},{v:0.5},{v:0.8},{v:0.5},{v:0.9},{v:0.6},{v:0.8},{v:0.6}],
                hihatO: [null,   null,  null,  null,   null,  null,  null,  {v:0.5},null,  null, null,  null,  null,   null,  null,   {v:0.5}],
                clap:   [null,   null,  null,  null,   null,  {v:0.8},null, null,  null,   null, null,  null,  null,   {v:0.9},null,  null],
                rim:    [null,   {v:0.4},null, null,   null,  null,  null,  null,  null,   {v:0.4},null,null, null,   null,   null,  null],
                tom:    [null,   null,  null,  null,   null,  null,  null,  null,  null,   null, null,  null,  null,   null,   null,  null],
                cymbal: [null,   null,  null,  null,   null,  null,  null,  null,  null,   null, null,  null,  null,   null,   null,  null]
            }
        },
        {
            name: 'NY Drill',
            genre: 'Drill',
            bpm: 140,
            swing: 0,
            pattern: {
                kick:   [{v:1},  null,  {v:0.7},null,  null,  null,  {v:0.9},null,  {v:1},  null,  null,  {v:0.8},null,  null,  {v:0.7},null],
                snare:  [null,   null,  null,   null,  {v:1}, null,  null,   null,  null,   null,  null,  null,   {v:1}, null,  null,   null],
                hihatC: [{v:0.9},{v:0.6},{v:0.9},{v:0.6},{v:0.9},{v:0.6},{v:0.9},{v:0.6},{v:0.9},{v:0.6},{v:0.9},{v:0.6},{v:0.9},{v:0.6},{v:0.9},{v:0.6}],
                hihatO: [null,   null,  null,   null,  null,  null,  null,   {v:0.6},null,  null,  null,  null,   null,  null,  null,   {v:0.6}],
                clap:   [null,   null,  null,   null,  {v:1}, null,  null,   null,  null,   null,  null,  null,   {v:1}, null,  null,   null],
                rim:    [null,   null,  null,   {v:0.5},null, null,  null,   null,  null,   null,  null,  {v:0.5},null, null,  null,   null],
                tom:    [null,   null,  null,   null,  null,  null,  null,   null,  null,   null,  null,  null,   null,  {v:0.6},{v:0.5},{v:0.4}],
                cymbal: [{v:0.7},null,  null,   null,  null,  null,  null,   null,  null,   null,  null,  null,   null,  null,  null,   null]
            }
        },

        // ── Lo-fi ───────────────────────────────────────────────────────

        {
            name: 'Lo-fi Chill',
            genre: 'Lo-fi',
            bpm: 85,
            swing: 70,
            pattern: {
                kick:   [{v:0.8},null,  null,  null,  null,  null,  {v:0.6},null,  {v:0.8},null, null,  null,  null,  null,  null,  null],
                snare:  [null,   null,  null,  {v:0.2},  {v:0.7},null, null,  {v:0.2},null, null, null,  {v:0.2},  {v:0.7},{v:0.2},null,  null],
                hihatC: [{v:0.5},{v:0.3},{v:0.5},{v:0.25},{v:0.5},{v:0.3},{v:0.5},{v:0.25},{v:0.5},{v:0.3},{v:0.5},{v:0.25},{v:0.5},{v:0.3},{v:0.5},{v:0.25}],
                hihatO: [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  {v:0.3},null],
                clap:   [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  null,  null],
                rim:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  null,  null],
                tom:    [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  null,  null],
                cymbal: [null,   null,  null,  null,  null,  null,  null,  null,  null,  null, null,  null,  null,  null,  null,  null]
            }
        },
        {
            name: 'Lo-fi Dusty',
            genre: 'Lo-fi',
            bpm: 85,
            swing: 70,
            pattern: {
                kick:   [{v:0.7},null,  null,  null,  null,  null,  null,  {v:0.6},null, null,  {v:0.7},null, null,  null,  null,  null],
                snare:  [null,   null,  null,  null,  null,  null,  null,  null,   null, null,  null,   null, null,  null,  null,  null],
                hihatC: [{v:0.4},{v:0.2},null, {v:0.3},{v:0.4},{v:0.2},null,{v:0.3},{v:0.4},{v:0.2},null,{v:0.3},{v:0.4},{v:0.2},null,{v:0.3}],
                hihatO: [null,   null,  null,  null,  null,  null,  {v:0.3},null, null, null,  null,   null, null,  null,  {v:0.3},null],
                clap:   [null,   null,  null,  null,  null,  null,  null,  null,  null, null,  null,   null, null,  null,  null,  null],
                rim:    [null,   null,  null,  null,  {v:0.6},null, null,  null,  null, null,  null,   null, {v:0.6},null, null,  {v:0.3}],
                tom:    [null,   null,  null,  null,  null,  null,  null,  null,  null, null,  null,   null, null,  null,  null,  null],
                cymbal: [null,   null,  null,  null,  null,  null,  null,  null,  null, null,  null,   null, null,  null,  null,  null]
            }
        }
    ];

    // ── Public API ──────────────────────────────────────────────────────

    /**
     * Return every registered drum pattern.
     */
    static getAll() {
        return DrumPatterns._patterns;
    }

    /**
     * Return all patterns that belong to a genre (case-insensitive).
     */
    static getByGenre(genre) {
        const lower = genre.toLowerCase();
        return DrumPatterns._patterns.filter(p => p.genre.toLowerCase() === lower);
    }

    /**
     * Return a deduplicated list of genre names.
     */
    static getGenres() {
        return [...new Set(DrumPatterns._patterns.map(p => p.genre))];
    }

    /**
     * Find a single pattern by exact name (case-insensitive).
     */
    static getPattern(name) {
        const lower = name.toLowerCase();
        return DrumPatterns._patterns.find(p => p.name.toLowerCase() === lower) || null;
    }
}
