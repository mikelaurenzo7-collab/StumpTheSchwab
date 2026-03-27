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
import ProjectManager from './ProjectManager.js';
import KeyboardHelp from './ui/KeyboardHelp.js';

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
        this.projectManager = null;
        this.keyboardHelp = null;

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
                    // Resize piano roll canvas when switching to it
                    if (view === 'pianoroll' && this.pianoRoll) {
                        this.pianoRoll.resize();
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

        // 2. Create effects processor (available for send buses)
        this.effects = new Effects(this.engine.getAudioContext());
        // Effects are available as send effects via the mixer
        // Connect effects output back to master gain
        this.effects.output.connect(this.engine.getMasterGain());

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

        // 5. Create UI components
        this._initUI();

        // 6. Wire everything together
        this._wireTransport();
        this._wireSequencer();
        this._wirePianoRoll();
        this._wireMixer();
        this._wireSynthPanel();
        this._wireEffectsPanel();
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
                const stepsPerBeat = 16 / beatsPerBar;
                const isDownbeat = step % 16 === 0;
                const isBeat = step % stepsPerBeat === 0;
                if (isBeat) {
                    this.engine.playMetronome(time, isDownbeat);
                }
            }

            // Play piano roll notes at this step
            if (this._pianoRollNotes && this._pianoRollNotes.length > 0) {
                const stepBeat = step / 4; // Convert step to beats (16 steps = 4 beats)
                this._pianoRollNotes.forEach(note => {
                    if (Math.abs(note.start - stepBeat) < 0.001) {
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
        const saveBtn = document.getElementById('btn-save');
        const loadBtn = document.getElementById('btn-load');
        const exportBtn = document.getElementById('btn-export');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const name = prompt('Project name:');
                if (!name) return;
                const state = this._gatherProjectState();
                this.projectManager.saveProject(name, state);
                this._updateStatus(`Saved: ${name}`);
            });
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                const projects = this.projectManager.listProjects();
                if (projects.length === 0) {
                    this._updateStatus('No saved projects');
                    return;
                }
                const names = projects.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
                const choice = prompt(`Load project:\n${names}\n\nEnter number:`);
                if (!choice) return;
                const idx = parseInt(choice, 10) - 1;
                if (idx >= 0 && idx < projects.length) {
                    const state = this.projectManager.loadProject(projects[idx].name);
                    if (state) {
                        this._restoreProjectState(state);
                        this._updateStatus(`Loaded: ${projects[idx].name}`);
                    }
                }
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (this.projectManager._isRecording) {
                    this.projectManager.stopRecording().then(blob => {
                        this.projectManager.downloadRecording(blob, 'nova-export.webm');
                        exportBtn.textContent = 'EXPORT';
                        exportBtn.classList.remove('recording');
                        this._updateStatus('Export saved');
                    });
                } else {
                    this.projectManager.startRecording(
                        this.engine.getAudioContext(),
                        this.engine.getMasterGain()
                    );
                    exportBtn.textContent = 'STOP REC';
                    exportBtn.classList.add('recording');
                    this._updateStatus('Recording... click STOP REC when done');
                }
            });
        }
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
