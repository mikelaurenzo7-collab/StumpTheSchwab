// ═══════════════════════════════════════════════════════════════
// NOVA — Main Application Orchestrator
// Wires engine, UI, and data layers together
// ═══════════════════════════════════════════════════════════════

import AudioEngine from './engine/AudioEngine.js';
import Synthesizer from './engine/Synthesizer.js';
import DrumMachine from './engine/DrumMachine.js';
import Effects from './engine/Effects.js';

import TransportBar from './ui/TransportBar.js';
import StepSequencer from './ui/StepSequencer.js';
import PianoRoll from './ui/PianoRoll.js';
import MixerPanel from './ui/MixerPanel.js';
import SynthPanel from './ui/SynthPanel.js';

import EffectsPanel from './ui/EffectsPanel.js';
import ArrangementView from './ui/ArrangementView.js';
import AIPanel from './ui/AIPanel.js';
import SpectrumAnalyzer from './ui/SpectrumAnalyzer.js';
import PerformanceView from './ui/PerformanceView.js';
import SoundDesigner from './ui/SoundDesigner.js';
import ProjectManager from './ProjectManager.js';
import KeyboardHelp from './ui/KeyboardHelp.js';
import MusicBrain from './ai/MusicBrain.js';
import Sampler from './engine/Sampler.js';
import MasteringChain from './engine/MasteringChain.js';

import Presets from './data/Presets.js';
import Scales from './data/Scales.js';
import DrumPatterns from './data/DrumPatterns.js';

class App {
    constructor() {
        this.engine = null;
        this.synth = null;
        this.drums = null;
        this.effects = null;
        this.transport = null;
        this.sequencer = null;
        this.pianoRoll = null;
        this.mixer = null;
        this.synthPanel = null;
        this.effectsPanel = null;
        this.arrangementView = null;
        this.aiPanel = null;
        this.spectrumAnalyzer = null;
        this.performanceView = null;
        this.soundDesigner = null;
        this.sampler = null;
        this.mastering = null;
        this.projectManager = null;
        this.keyboardHelp = null;
        this._masteringEnabled = false;

        this.isInitialized = false;
        this.metronomeOn = false;
        this.currentScale = 'Natural Minor';
        this.currentRoot = 0; // C
        this.baseOctave = 4;
        this.activeKeys = new Set();
        this.keyboardMap = Scales.getKeyboardMap(this.baseOctave);

        this._initSplash();
        this._initViewTabs();
    }

    // ── Splash Screen ──
    _initSplash() {
        const splash = document.getElementById('splash');
        const startBtn = document.getElementById('splash-start');
        this._createParticles();

        startBtn.addEventListener('click', () => {
            this._init();
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.style.display = 'none';
                document.getElementById('app').classList.remove('hidden');
            }, 600);
        });
    }

    _createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.style.cssText = `
                position: absolute;
                width: ${2 + Math.random() * 3}px;
                height: ${2 + Math.random() * 3}px;
                background: ${Math.random() > 0.5 ? '#00d4ff' : '#7b2fff'};
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                opacity: ${0.1 + Math.random() * 0.4};
                animation: particleFloat ${5 + Math.random() * 10}s linear infinite;
                animation-delay: ${-Math.random() * 10}s;
            `;
            container.appendChild(p);
        }

        // Add particle animation
        if (!document.getElementById('particle-style')) {
            const style = document.createElement('style');
            style.id = 'particle-style';
            style.textContent = `
                @keyframes particleFloat {
                    0% { transform: translateY(0) translateX(0); opacity: 0; }
                    10% { opacity: 0.4; }
                    90% { opacity: 0.4; }
                    100% { transform: translateY(-100vh) translateX(${Math.random() > 0.5 ? '' : '-'}50px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ── View Tabs ──
    _initViewTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const view = btn.dataset.view;
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                const targetView = document.getElementById(`${view}-view`);
                if (targetView) {
                    targetView.classList.add('active');
                    // Resize canvases after layout completes
                    if (view === 'pianoroll' && this.pianoRoll) {
                        requestAnimationFrame(() => this.pianoRoll.resize());
                    }
                }
            });
        });
    }

    // ── Core Initialization ──
    _init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // 1. Create audio engine
        this.engine = new AudioEngine();

        // 2. Create effects processor and insert into master bus chain
        //    Audio path: channels → masterGain → [effects] → masterAnalyser → limiter → destination
        this.effects = new Effects(this.engine.getAudioContext());
        this.engine.masterGain.disconnect(this.engine.masterAnalyser);
        this.effects.connectChain(this.engine.masterGain, this.engine.masterAnalyser);

        // 3. Create synthesizer (routed to channel 0)
        this.synth = new Synthesizer(
            this.engine.getAudioContext(),
            this.engine.getChannelOutput(0)
        );

        // 4. Create drum machine (routed to channel 4)
        this.drums = new DrumMachine(
            this.engine.getAudioContext(),
            this.engine.getChannelOutput(4)
        );

        // 4b. Create sampler (routed to channel 1)
        this.sampler = new Sampler(
            this.engine.getAudioContext(),
            this.engine.getChannelOutput(1)
        );

        // 4c. Create mastering chain (sits between effects output and analyser)
        this.mastering = new MasteringChain(this.engine.getAudioContext());

        // 5. Create UI components
        this._initUI();

        // 6. Wire everything together
        this._wireTransport();
        this._wireSequencer();
        this._wirePianoRoll();
        this._wireMixer();
        this._wireSynthPanel();
        this._wireEffectsPanel();
        this._wireArrangement();
        this._wireAIPanel();
        this._wireSoundDesigner();
        this._wirePerformance();
        this._wireMastering();
        this._wireKeyboard();
        this._wireEngine();
        this._wireProjectManager();
        this._wireHelpButton();

        // 7. Load default state
        this._loadDefaults();

        // 8. Start meter animation
        this._startMeters();

        // 9. Start CPU monitor
        this._startCPUMonitor();

        this._updateStatus('NOVA Initialized — Ready to create');
    }

    _initUI() {
        this.transport = new TransportBar(document.getElementById('transport-bar'));
        this.sequencer = new StepSequencer(document.getElementById('sequencer-view'));
        this.pianoRoll = new PianoRoll(document.getElementById('pianoroll-view'));
        this.mixer = new MixerPanel(document.getElementById('mixer-panel'));
        this.synthPanel = new SynthPanel(document.getElementById('synth-panel'));
        this.effectsPanel = new EffectsPanel(document.getElementById('effects-view'));
        this.arrangementView = new ArrangementView(document.getElementById('arrangement-view'));
        this.aiPanel = new AIPanel(document.getElementById('ai-view'));
        this.spectrumAnalyzer = new SpectrumAnalyzer(document.getElementById('spectrum-analyzer'));
        this.spectrumAnalyzer.connectAnalyser(this.engine.masterAnalyser);
        this.performanceView = new PerformanceView(document.getElementById('performance-view'));
        this.soundDesigner = new SoundDesigner(document.getElementById('ai-view'));
        this.projectManager = new ProjectManager();
        this.keyboardHelp = new KeyboardHelp();
    }

    // ── Wire: Transport ──
    _wireTransport() {
        this.transport.onPlay(() => {
            this.engine.play();
            this.transport.setPlaying(true);
            this._updateStatus('Playing...');
        });

        this.transport.onStop(() => {
            this.engine.stop();
            this.transport.setPlaying(false);
            this.sequencer.clearHighlight();
            this.pianoRoll.setPlayheadPosition(-1);
            this._updateStatus('Stopped');
        });

        this.transport.onBpmChange((bpm) => {
            this.engine.setBPM(bpm);
            if (this.effects) {
                this.effects.syncDelayToBPM(bpm);
            }
        });

        this.transport.onMasterVolumeChange((vol) => {
            this.engine.getMasterGain().gain.setValueAtTime(
                vol, this.engine.getAudioContext().currentTime
            );
        });

        this.transport.onMetronomeToggle((on) => {
            this.metronomeOn = on;
        });
    }

    // ── Wire: Step Sequencer ──
    _wireSequencer() {
        this.sequencer.onStepChange((sound, step, velocity) => {
            if (velocity !== null && velocity !== undefined) {
                this.drums.setStep(sound, step, velocity);
            } else {
                this.drums.setStep(sound, step, null);
            }
        });

        this.sequencer.onSwingChange((value) => {
            this.engine.setSwing(value);
        });

        this.sequencer.onGenreSelect((genre) => {
            const patterns = DrumPatterns.getByGenre(genre);
            if (patterns && patterns.length > 0) {
                const patternData = patterns[0];
                // Load into drum machine (handles {v} objects internally)
                this.drums.loadPattern(patternData.pattern);
                // Convert {v} objects to raw velocity numbers for step sequencer UI
                const uiPattern = {};
                for (const [sound, steps] of Object.entries(patternData.pattern)) {
                    uiPattern[sound] = steps.map(s => {
                        if (s === null) return null;
                        if (typeof s === 'object' && s.v !== undefined) return s.v;
                        if (typeof s === 'number') return s;
                        return null;
                    });
                }
                this.sequencer.setPattern(uiPattern);
                if (patternData.bpm) {
                    this.engine.setBPM(patternData.bpm);
                    this.transport.setBPM(patternData.bpm);
                }
                if (patternData.swing != null) {
                    this.engine.setSwing(patternData.swing);
                    this.sequencer.setSwing(patternData.swing);
                }
                this._updateStatus(`Loaded ${patternData.name} pattern`);
            }
        });

        this.sequencer.onClear(() => {
            this.drums.clearPattern();
            this._updateStatus('Pattern cleared');
        });
    }

    // ── Wire: Piano Roll ──
    _wirePianoRoll() {
        this.pianoRoll.onNoteChange((notes) => {
            // Notes changed in piano roll — store for playback
            this._pianoRollNotes = notes;
        });

        this.pianoRoll.onNotePreview((midi) => {
            if (midi !== null) {
                this.synth.noteOn(midi, 0.5);
                setTimeout(() => this.synth.noteOff(midi), 200);
            }
        });

        // Set initial scale
        this.pianoRoll.setScale(this.currentScale, this.currentRoot);
    }

    // ── Wire: Mixer ──
    _wireMixer() {
        this.mixer.onVolumeChange((ch, val) => {
            this.engine.setChannelVolume(ch, val);
        });

        this.mixer.onPanChange((ch, val) => {
            this.engine.setChannelPan(ch, val);
        });

        this.mixer.onMuteToggle((ch, muted) => {
            this.engine.setChannelMute(ch, muted);
        });

        this.mixer.onSoloToggle((ch, solo) => {
            this.engine.setChannelSolo(ch, solo);
        });

        this.mixer.onSendChange((ch, sendType, amount) => {
            this.engine.setSendLevel(ch, sendType, amount);
        });

        this.mixer.onMasterVolumeChange((vol) => {
            this.engine.getMasterGain().gain.setValueAtTime(
                vol, this.engine.getAudioContext().currentTime
            );
            this.transport.setMasterVolume && this.transport.setMasterVolume(vol);
        });
    }

    // ── Wire: Synth Panel ──
    _wireSynthPanel() {
        // Load presets into dropdown
        const allPresets = Presets.getAll();
        this.synthPanel.loadPresets(allPresets);

        // Connect oscilloscope
        this.synthPanel.connectAnalyser(this.engine.masterAnalyser);

        // Param changes → synth
        this.synthPanel.onParamChange((param, value) => {
            this.synth.setParam(param, value);
        });

        // Preset changes → load into synth + update panel
        this.synthPanel.onPresetChange((name) => {
            const preset = Presets.getPresetByName(name);
            if (preset) {
                this.synth.loadPreset(preset);
                this.synthPanel.setParams(preset);
                this.synthPanel.selectPreset(name);
                this._updateStatus(`Preset: ${name}`);
            }
        });
    }

    // ── Wire: Keyboard (QWERTY → MIDI) ──
    _wireKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

            const key = e.key.toLowerCase();

            // Octave shift with number keys
            if (key >= '1' && key <= '8') {
                this.baseOctave = parseInt(key);
                this.keyboardMap = Scales.getKeyboardMap(this.baseOctave);
                this._updateStatus(`Octave: ${this.baseOctave}`);
                return;
            }

            // ? = toggle keyboard help
            if (e.key === '?' || (e.shiftKey && key === '/')) {
                this.keyboardHelp.toggle();
                return;
            }

            // Escape = close help overlay
            if (key === 'escape') {
                if (this.keyboardHelp.isVisible) {
                    this.keyboardHelp.hide();
                }
                return;
            }

            // Space = play/stop
            if (key === ' ') {
                e.preventDefault();
                if (this.engine.isPlaying) {
                    this.engine.stop();
                    this.transport.setPlaying(false);
                    this.sequencer.clearHighlight();
                    this._updateStatus('Stopped');
                } else {
                    this.engine.play();
                    this.transport.setPlaying(true);
                    this._updateStatus('Playing...');
                }
                return;
            }

            // Note keys
            const midi = this.keyboardMap[key];
            if (midi !== undefined && !this.activeKeys.has(key)) {
                this.activeKeys.add(key);
                this.synth.noteOn(midi, 0.8);
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            const midi = this.keyboardMap[key];
            if (midi !== undefined && this.activeKeys.has(key)) {
                this.activeKeys.delete(key);
                this.synth.noteOff(midi);
            }
        });
    }

    // ── Wire: Engine Events ──
    _wireEngine() {
        // Step event → trigger drums + update UI
        this.engine.on('step', (step, time) => {
            // Trigger drum sounds for this step
            const soundNames = this.drums.getSoundNames();
            soundNames.forEach(sound => {
                const velocity = this.drums.getStep(sound, step);
                if (velocity !== null && velocity !== undefined) {
                    this.drums.trigger(sound, time, velocity);
                }
            });

            // Metronome
            if (this.metronomeOn) {
                const beatsPerBar = this.engine.timeSignature?.beats || 4;
                const stepsPerBeat = this.engine.totalSteps / beatsPerBar;
                const isDownbeat = step === 0;
                const isBeat = step % stepsPerBeat === 0;
                if (isBeat) {
                    this.engine.playMetronome(time, isDownbeat);
                }
            }

            // Play piano roll notes at this step
            if (this._pianoRollNotes && this._pianoRollNotes.length > 0) {
                const stepBeat = step / 4; // Convert step to beats (16 steps = 4 beats)
                const stepBeatInt = Math.round(stepBeat * 1000);
                this._pianoRollNotes.forEach(note => {
                    if (Math.round(note.start * 1000) === stepBeatInt) {
                        const durationSteps = note.duration * 4;
                        const durationSeconds = durationSteps * this.engine._getStepDuration(step);
                        this.synth.noteOn(note.midi, note.velocity || 0.8, time);
                        // Schedule note off
                        const offTime = time + durationSeconds;
                        setTimeout(() => {
                            this.synth.noteOff(note.midi);
                        }, (offTime - this.engine.getAudioContext().currentTime) * 1000);
                    }
                });
            }

            // Update sequencer playhead (must be on UI thread)
            requestAnimationFrame(() => {
                this.sequencer.highlightStep(step);
                this.pianoRoll.setPlayheadPosition(step / 4);

                // Update beat indicators
                const beatsPerBar = this.engine.timeSignature?.beats || 4;
                const stepsPerBeat = 16 / beatsPerBar;
                if (step % stepsPerBeat === 0) {
                    const beatIndex = Math.floor(step / stepsPerBeat) % beatsPerBar;
                    this.transport.setBeat(beatIndex);
                }
            });
        });

        this.engine.on('stop', () => {
            this.transport.setPlaying(false);
            this.transport.resetBeat();
            this.sequencer.clearHighlight();
            this.synth.allNotesOff();
        });
    }

    // ── Wire: Arrangement View ──
    _wireArrangement() {
        this.arrangementView.onModeChange((mode) => {
            this._updateStatus(`Mode: ${mode.toUpperCase()}`);
        });

        this.arrangementView.onSceneChange((barIndex, sceneData) => {
            if (sceneData) {
                // Load scene's drum pattern into drum machine
                if (sceneData.drumPattern) {
                    this.drums.loadPattern(sceneData.drumPattern);
                }
                // Load scene's synth notes for piano roll playback
                if (sceneData.synthNotes) {
                    this._pianoRollNotes = sceneData.synthNotes;
                }
            }
        });
    }

    // ── Wire: AI Composer Panel ──
    _wireAIPanel() {
        const KEY_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

        // Convert mood slider values to a mood string for MusicBrain
        const moodFromSliders = (moodObj) => {
            if (typeof moodObj === 'string') return moodObj;
            const brightness = (moodObj?.dark_bright ?? 50) / 100;
            const energy = (moodObj?.calm_energetic ?? 50) / 100;
            if (brightness < 0.3 && energy < 0.4) return 'dark';
            if (brightness < 0.3 && energy >= 0.4) return 'aggressive';
            if (brightness < 0.5 && energy < 0.4) return 'sad';
            if (brightness < 0.5) return 'chill';
            if (brightness >= 0.7 && energy >= 0.7) return 'epic';
            if (brightness >= 0.5 && energy < 0.4) return 'dreamy';
            if (brightness >= 0.5 && energy >= 0.4) return 'happy';
            return 'nostalgic';
        };

        // Store last generated chords for melody/bass generation
        this._lastAIChords = [];

        this.aiPanel.onGenerateChords((key, scale, moodObj, bars) => {
            const mood = moodFromSliders(moodObj);
            const chords = MusicBrain.generateChords(key, scale, mood, bars);
            this._lastAIChords = chords;
            const notes = [];
            chords.forEach(chord => {
                chord.notes.forEach(midi => {
                    notes.push({ midi, start: chord.start || 0, duration: chord.duration || 1, velocity: 0.7 });
                });
            });
            this.pianoRoll.setNotes(notes);
            this._pianoRollNotes = notes;
            this.aiPanel.setStatus(`Generated ${chords.length}-chord ${mood} progression`);
            this.aiPanel.pushHistory(`Chords: ${mood} in ${KEY_NAMES[key]} ${scale}`);
            this._updateStatus(`AI: ${mood} chord progression generated`);
        });

        this.aiPanel.onGenerateMelody((_chords, scale, key, density, bars) => {
            const chords = this._lastAIChords.length > 0 ? this._lastAIChords : MusicBrain.generateChords(key, scale, 'chill', bars);
            if (this._lastAIChords.length === 0) this._lastAIChords = chords;
            const currentNotes = this.pianoRoll.getNotes();
            const melody = MusicBrain.generateMelody(chords, scale, key, density, bars);
            const allNotes = [...currentNotes, ...melody];
            this.pianoRoll.setNotes(allNotes);
            this._pianoRollNotes = allNotes;
            this.aiPanel.setStatus(`Generated ${melody.length}-note ${density} melody`);
            this.aiPanel.pushHistory(`Melody: ${density} density`);
            this._updateStatus('AI: Melody generated');
        });

        this.aiPanel.onGenerateBassline((_chords, genre, key) => {
            const chords = this._lastAIChords.length > 0 ? this._lastAIChords : MusicBrain.generateChords(key, 'minor', 'chill', 4);
            if (this._lastAIChords.length === 0) this._lastAIChords = chords;
            const currentNotes = this.pianoRoll.getNotes();
            const bassline = MusicBrain.generateBassline(chords, genre, key);
            const allNotes = [...currentNotes, ...bassline];
            this.pianoRoll.setNotes(allNotes);
            this._pianoRollNotes = allNotes;
            this.aiPanel.setStatus(`Generated ${bassline.length}-note ${genre} bassline`);
            this.aiPanel.pushHistory(`Bassline: ${genre}`);
            this._updateStatus('AI: Bassline generated');
        });

        this.aiPanel.onGenerateBeat((genre, complexity, variation) => {
            const pattern = MusicBrain.generateDrumPattern(genre, complexity, variation);
            this.drums.loadPattern(pattern);
            this.sequencer.setPattern(pattern);
            this.aiPanel.setStatus(`Generated ${genre} beat (complexity ${complexity})`);
            this.aiPanel.pushHistory(`Beat: ${genre} x${complexity}`);
            this._updateStatus('AI: Drum pattern generated');
        });

        this.aiPanel.onSurprise(() => {
            const genres = ['trap', 'house', 'boombap', 'rnb', 'lofi', 'pop'];
            const moods = ['happy', 'sad', 'dark', 'epic', 'chill', 'dreamy'];
            const scales = ['major', 'minor', 'dorian', 'pentatonic'];
            const genre = genres[Math.floor(Math.random() * genres.length)];
            const mood = moods[Math.floor(Math.random() * moods.length)];
            const scale = scales[Math.floor(Math.random() * scales.length)];
            const key = Math.floor(Math.random() * 12);

            // Generate full track
            const chords = MusicBrain.generateChords(key, scale, mood, 4);
            this._lastAIChords = chords;
            const melody = MusicBrain.generateMelody(chords, scale, key, 'medium', 4);
            const bassline = MusicBrain.generateBassline(chords, genre, key);
            const beat = MusicBrain.generateDrumPattern(genre, 3, Math.random());

            // Apply everything to piano roll
            const chordNotes = [];
            chords.forEach(chord => {
                chord.notes.forEach(midi => {
                    chordNotes.push({ midi, start: chord.start || 0, duration: chord.duration || 1, velocity: 0.65 });
                });
            });
            const allNotes = [...chordNotes, ...melody, ...bassline];
            this.pianoRoll.setNotes(allNotes);
            this._pianoRollNotes = allNotes;

            // Apply drums
            this.drums.loadPattern(beat);
            this.sequencer.setPattern(beat);

            // Apply mood parameters to synth and effects
            const moodParams = MusicBrain.getMoodParams(mood, 0.6);
            if (moodParams.synth) {
                this.synth.setParam('filter.frequency', moodParams.synth.filterFrequency);
                this.synth.setParam('filter.Q', moodParams.synth.filterQ);
                this.synth.setParam('ampEnv.attack', moodParams.synth.ampAttack);
                this.synth.setParam('ampEnv.release', moodParams.synth.ampRelease);
            }
            if (moodParams.effects) {
                this.effects.setReverbParam('wetDry', moodParams.effects.reverbWet);
                this.effects.setReverbParam('roomSize', moodParams.effects.reverbSize);
                this.effects.setBypass('reverb', moodParams.effects.reverbWet < 0.05);
                this.effects.setDelayParam('wetDry', moodParams.effects.delayWet);
                this.effects.setBypass('delay', moodParams.effects.delayWet < 0.05);
                if (moodParams.effects.distortionAmount > 0.05) {
                    this.effects.setDistortionParam('amount', moodParams.effects.distortionAmount);
                    this.effects.setDistortionParam('wetDry', 0.5);
                    this.effects.setBypass('distortion', false);
                }
                if (moodParams.effects.chorusWet > 0.05) {
                    this.effects.setChorusParam('wetDry', moodParams.effects.chorusWet);
                    this.effects.setBypass('chorus', false);
                }
            }
            if (moodParams.bpmRange?.suggested) {
                this.engine.setBPM(moodParams.bpmRange.suggested);
                this.transport.setBPM(moodParams.bpmRange.suggested);
            }

            this.aiPanel.setStatus(`Surprise: ${mood} ${genre} in ${KEY_NAMES[key]} ${scale}`);
            this.aiPanel.pushHistory(`Surprise: ${mood} ${genre}`);
            this._updateStatus(`AI: Full ${mood} ${genre} track generated`);
        });

        this.aiPanel.onMoodChange((moodSliders) => {
            const moodName = moodFromSliders(moodSliders);
            const intensity = (moodSliders.calm_energetic ?? 50) / 100;
            const params = MusicBrain.getMoodParams(moodName, intensity);

            // Apply synth params in real-time
            if (params.synth?.filterFrequency) {
                this.synth.setParam('filter.frequency', params.synth.filterFrequency);
            }

            // Apply effects
            if (params.effects) {
                this.effects.setReverbParam('wetDry', params.effects.reverbWet);
                this.effects.setBypass('reverb', params.effects.reverbWet < 0.05);
                this.effects.setChorusParam('wetDry', params.effects.chorusWet);
                this.effects.setBypass('chorus', params.effects.chorusWet < 0.05);
            }
        });

        this.aiPanel.onUndo(() => {
            this.pianoRoll.clear();
            this._pianoRollNotes = [];
            this._lastAIChords = [];
            this._updateStatus('AI: Undo');
        });
    }

    // ── Wire: Sound Designer ──
    _wireSoundDesigner() {
        this.soundDesigner.onDesign((description) => {
            const result = MusicBrain.designSound(description);
            // Apply synth patch
            this.synth.loadPreset(result.patch);
            this.synthPanel.setParams(result.patch);
            // Apply effects
            if (result.effects.reverb && !result.effects.reverb.bypass) {
                this.effects.setReverbParam('wetDry', result.effects.reverb.wetDry);
                this.effects.setReverbParam('roomSize', result.effects.reverb.roomSize);
                this.effects.setBypass('reverb', false);
            }
            if (result.effects.delay && !result.effects.delay.bypass) {
                this.effects.setDelayParam('wetDry', result.effects.delay.wetDry);
                this.effects.setDelayParam('feedback', result.effects.delay.feedback);
                this.effects.setBypass('delay', false);
            }
            if (result.effects.chorus && !result.effects.chorus.bypass) {
                this.effects.setChorusParam('wetDry', result.effects.chorus.wetDry);
                this.effects.setBypass('chorus', false);
            }
            if (result.effects.distortion && !result.effects.distortion.bypass) {
                this.effects.setDistortionParam('amount', result.effects.distortion.amount);
                this.effects.setDistortionParam('wetDry', result.effects.distortion.wetDry);
                this.effects.setBypass('distortion', false);
            }
            this.soundDesigner.setResult(result);
            this._updateStatus(`Sound designed: ${result.matched.join(' + ') || 'default'}`);
        });

        this.soundDesigner.onReapply((entry) => {
            if (entry && entry.result) {
                this.synth.loadPreset(entry.result.patch);
                this.synthPanel.setParams(entry.result.patch);
                this._updateStatus(`Re-applied: ${entry.description}`);
            }
        });
    }

    // ── Wire: Performance View ──
    _wirePerformance() {
        this.performanceView.onClipTrigger((row, col, clipData) => {
            if (clipData) {
                if (row === 0 && clipData.drumPattern) {
                    this.drums.loadPattern(clipData.drumPattern);
                    this.sequencer.setPattern(clipData.drumPattern);
                }
                if ((row === 1 || row === 2) && clipData.synthNotes) {
                    this._pianoRollNotes = clipData.synthNotes;
                }
            }
            this._updateStatus(`Clip launched: row ${row}, col ${col}`);
        });

        this.performanceView.onClipStop((row) => {
            if (row === 0) {
                this.drums.clearPattern();
            }
            if (row === 1 || row === 2) {
                this._pianoRollNotes = [];
            }
            this._updateStatus(`Row ${row} stopped`);
        });

        this.performanceView.onMacroChange((macroName, value) => {
            switch (macroName) {
                case 'ATMOSPHERE':
                    this.effects.setReverbParam('wetDry', value * 0.8);
                    this.effects.setDelayParam('wetDry', value * 0.5);
                    this.effects.setChorusParam('wetDry', value * 0.4);
                    this.effects.setBypass('reverb', value < 0.05);
                    this.effects.setBypass('delay', value < 0.05);
                    this.effects.setBypass('chorus', value < 0.05);
                    break;
                case 'ENERGY':
                    this.synth.setParam('filter.frequency', 1000 + value * 7000);
                    if (value > 0.3) {
                        this.effects.setDistortionParam('amount', (value - 0.3) * 0.43);
                        this.effects.setDistortionParam('wetDry', 0.5);
                        this.effects.setBypass('distortion', false);
                    }
                    break;
                case 'SPACE':
                    this.effects.setReverbParam('roomSize', 0.2 + value * 0.7);
                    this.effects.setDelayParam('feedback', 0.1 + value * 0.4);
                    break;
                case 'GRIT':
                    this.effects.setDistortionParam('amount', value * 0.6);
                    this.effects.setDistortionParam('wetDry', value > 0.05 ? 0.5 : 0);
                    this.effects.setBypass('distortion', value < 0.05);
                    this.synth.setParam('filter.Q', 1 + value * 11);
                    break;
            }
        });
    }

    // ── Wire: Mastering ──
    _wireMastering() {
        // Add mastering toggle to transport area
        const transportInner = document.querySelector('.transport-inner');
        if (transportInner) {
            const masterBtn = document.createElement('button');
            masterBtn.className = 'transport-btn';
            masterBtn.id = 'btn-mastering';
            masterBtn.title = 'Toggle Mastering';
            masterBtn.textContent = 'M';
            masterBtn.style.cssText = 'font-size:11px;font-weight:900;width:36px;height:36px;';

            masterBtn.addEventListener('click', () => {
                this._masteringEnabled = !this._masteringEnabled;
                if (this._masteringEnabled) {
                    // Insert mastering between effects output and analyser
                    this.effects.output.disconnect(this.engine.masterAnalyser);
                    this.mastering.connectChain(this.effects.output, this.engine.masterAnalyser);
                    masterBtn.classList.add('active');
                    masterBtn.style.background = 'rgba(123, 47, 255, 0.2)';
                    masterBtn.style.borderColor = '#7b2fff';
                    masterBtn.style.color = '#7b2fff';
                    this._updateStatus('Mastering ON — Professional output enabled');
                } else {
                    this.mastering.disconnectChain();
                    this.effects.output.connect(this.engine.masterAnalyser);
                    masterBtn.classList.remove('active');
                    masterBtn.style.background = '';
                    masterBtn.style.borderColor = '';
                    masterBtn.style.color = '';
                    this._updateStatus('Mastering OFF');
                }
            });

            // Insert before the master volume section
            const masterSection = transportInner.querySelector('.transport-master');
            if (masterSection) {
                transportInner.insertBefore(masterBtn, masterSection);
            } else {
                transportInner.appendChild(masterBtn);
            }
        }
    }

    // ── Wire: Effects Panel ──
    _wireEffectsPanel() {
        this.effectsPanel.onParamChange((effectName, param, value) => {
            switch (effectName) {
                case 'eq':
                    this.effects.setEQParam(param.split('.')[0], param.split('.')[1], value);
                    break;
                case 'distortion':
                    this.effects.setDistortionParam(param, value);
                    break;
                case 'chorus':
                    this.effects.setChorusParam(param, value);
                    break;
                case 'delay':
                    this.effects.setDelayParam(param, value);
                    break;
                case 'reverb':
                    this.effects.setReverbParam(param, value);
                    break;
                case 'compressor':
                    this.effects.setCompressorParam(param, value);
                    break;
            }
        });

        this.effectsPanel.onBypassChange((effectName, bypassed) => {
            this.effects.setBypass(effectName, bypassed);
            this._updateStatus(`${effectName} ${bypassed ? 'bypassed' : 'enabled'}`);
        });
    }

    // ── Wire: Project Manager ──
    _wireProjectManager() {
        // Use the ProjectManager's built-in modal UI
        const pmContainer = document.getElementById('pm-trigger-container');
        if (!pmContainer) return;

        const hooks = this.projectManager.buildSaveLoadUI(pmContainer);

        hooks.onSave((name) => {
            const state = this._gatherProjectState();
            this.projectManager.saveProject(name, state);
            this._updateStatus(`Saved: ${name}`);
        });

        hooks.onLoad((name) => {
            const state = this.projectManager.loadProject(name);
            if (state) {
                this._restoreProjectState(state);
                this._updateStatus(`Loaded: ${name}`);
            }
        });

        hooks.onExport(() => {
            const state = this._gatherProjectState();
            this.projectManager.exportProjectJSON(state, 'nova-project');
            this._updateStatus('Project exported as JSON');
        });

        hooks.onImport((state, filename) => {
            this._restoreProjectState(state);
            this._updateStatus(`Imported: ${filename}`);
        });

        hooks.onRecord((action) => {
            if (action === 'start') {
                this.projectManager.startRecording(
                    this.engine.getAudioContext(),
                    this.engine.getMasterGain()
                );
                this._updateStatus('Recording...');
            } else {
                this.projectManager.stopRecording().then(blob => {
                    this.projectManager.downloadRecording(blob, 'nova-recording');
                    this._updateStatus('Recording saved');
                });
            }
        });

        hooks.onBounce((duration) => {
            this._updateStatus(`Bouncing ${duration}s...`);
            this.projectManager.bounceToWAV(
                this.engine.getAudioContext(),
                this.engine.getMasterGain(),
                duration
            ).then(blob => {
                this.projectManager.downloadRecording(blob, 'nova-bounce.wav');
                this._updateStatus('WAV bounce complete');
            });
        });
    }

    _gatherProjectState() {
        return {
            bpm: this.engine.bpm,
            swing: this.engine.swing,
            timeSignature: { ...this.engine.timeSignature },
            synthParams: this.synth.getParams(),
            drumPatterns: this.drums.getPattern(),
            drumPatternIndex: this.drums.currentPattern,
            pianoRollNotes: this.pianoRoll ? this.pianoRoll.getNotes() : [],
            mixerState: this.engine.channels.map(ch => ({
                volume: ch.volume,
                pan: ch.pan,
                muted: ch.muted,
                solo: ch.solo
            })),
            masterVolume: this.engine.masterGain.gain.value,
            effectsState: this.effects.getAllParams()
        };
    }

    _restoreProjectState(state) {
        if (state.bpm) {
            this.engine.setBPM(state.bpm);
            this.transport.setBPM(state.bpm);
        }
        if (state.swing != null) {
            this.engine.setSwing(state.swing);
            this.sequencer.setSwing(state.swing);
        }
        if (state.synthParams) {
            this.synth.loadPreset(state.synthParams);
            this.synthPanel.setParams(state.synthParams);
        }
        if (state.drumPatterns) {
            this.drums.loadPattern(state.drumPatterns);
            this.sequencer.setPattern(state.drumPatterns);
        }
        if (state.pianoRollNotes) {
            this.pianoRoll.setNotes(state.pianoRollNotes);
            this._pianoRollNotes = state.pianoRollNotes;
        }
        if (state.mixerState) {
            state.mixerState.forEach((ch, i) => {
                this.engine.setChannelVolume(i, ch.volume);
                this.engine.setChannelPan(i, ch.pan);
                this.engine.setChannelMute(i, ch.muted);
                this.engine.setChannelSolo(i, ch.solo);
                this.mixer.setChannelVolume(i, ch.volume);
                this.mixer.setChannelPan(i, ch.pan);
                this.mixer.setChannelMute(i, ch.muted);
                this.mixer.setChannelSolo(i, ch.solo);
            });
        }
        if (state.masterVolume != null) {
            this.engine.getMasterGain().gain.setValueAtTime(
                state.masterVolume, this.engine.getAudioContext().currentTime
            );
        }
    }

    // ── Wire: Help Button ──
    _wireHelpButton() {
        const helpBtn = document.getElementById('btn-help');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.keyboardHelp.toggle();
            });
        }
    }

    // ── Defaults ──
    _loadDefaults() {
        // Load a default preset
        const defaultPreset = Presets.getPresetByName('Classic Analog');
        if (defaultPreset) {
            this.synth.loadPreset(defaultPreset);
            this.synthPanel.setParams(defaultPreset);
            this.synthPanel.selectPreset('Classic Analog');
        }

        // Set default scale display
        this._updateScaleDisplay();
    }

    // ── Level Meters ──
    _startMeters() {
        const update = () => {
            if (!this.engine) return;

            // Update channel meters
            for (let i = 0; i < 8; i++) {
                const level = this.engine.getChannelLevel(i);
                this.mixer.setLevel(i, level);
            }

            // Update master meter
            const masterLevel = this.engine.getMasterLevel();
            const maxLevel = Math.max(masterLevel.left || 0, masterLevel.right || 0);
            this.mixer.setMasterLevel(maxLevel);

            this._meterFrame = requestAnimationFrame(update);
        };
        update();
    }

    // ── CPU Monitor ──
    _startCPUMonitor() {
        setInterval(() => {
            const el = document.getElementById('cpu-value');
            if (!el || !this.engine) return;
            // Rough estimate based on audio context
            const ctx = this.engine.getAudioContext();
            if (ctx.baseLatency) {
                const load = Math.round((ctx.baseLatency / (128 / ctx.sampleRate)) * 100);
                el.textContent = Math.min(load, 100) + '%';
            }
        }, 1000);
    }

    // ── Status Updates ──
    _updateStatus(text) {
        const el = document.getElementById('status-text');
        if (el) el.textContent = text;
    }

    _updateScaleDisplay() {
        const keyEl = document.getElementById('status-key');
        const scaleEl = document.getElementById('status-scale');
        if (keyEl) keyEl.textContent = `Key: ${Scales.NOTE_NAMES[this.currentRoot]} Minor`;
        if (scaleEl) scaleEl.textContent = `Scale: ${this.currentScale}`;
    }
}

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => {
    window.novaApp = new App();
});
