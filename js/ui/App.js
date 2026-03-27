/**
 * NOVA DAW — Main Application Controller
 * Orchestrates all modules: audio engine, instruments, UI, and state.
 */

import { AudioEngine } from '../engine/AudioEngine.js';
import { Synthesizer } from '../engine/Synthesizer.js';
import { DrumMachine } from '../engine/DrumMachine.js';
import { EffectsChain, Reverb, Delay, Distortion, Chorus, Compressor, EQ } from '../engine/Effects.js';
import { SYNTH_PRESETS } from '../data/presets.js';
import { SCALES, CHORDS, getNoteFrequency, midiToFrequency, midiToNoteName, noteNameToMidi, getScaleNotes } from '../data/scales.js';
import { DRUM_PATTERNS } from '../data/drumPatterns.js';
import { TransportBar } from './TransportBar.js';
import { StepSequencer } from './StepSequencer.js';
import { PianoRoll } from './PianoRoll.js';
import { MixerPanel } from './MixerPanel.js';
import { SynthPanel } from './SynthPanel.js';

export class App {
  constructor() {
    this.engine = null;
    this.synth = null;
    this.drumMachine = null;
    this.effects = {};
    this.ui = {};
    this.state = {
      currentView: 'sequencer', // 'sequencer' | 'pianoroll'
      isPlaying: false,
      currentStep: 0,
      currentBeat: 0,
    };
    this.animFrameId = null;
  }

  /**
   * Initialize the application — called after user clicks "Start"
   */
  async init() {
    // 1. Create audio engine
    this.engine = new AudioEngine();
    await this.engine.init();

    // 2. Create instruments
    this._createInstruments();

    // 3. Create effects chains
    this._createEffects();

    // 4. Route audio
    this._routeAudio();

    // 5. Build UI
    this._buildUI();

    // 6. Set up scheduling
    this._setupScheduler();

    // 7. Load defaults
    this._loadDefaults();

    // 8. Start render loop
    this._startRenderLoop();

    // 9. Set up keyboard shortcuts
    this._setupKeyboard();

    console.log('[NOVA] Initialized successfully');
  }

  _createInstruments() {
    const ctx = this.engine.audioContext;

    // Main synth
    this.synth = new Synthesizer(ctx);

    // Drum machine
    this.drumMachine = new DrumMachine(ctx);
  }

  _createEffects() {
    const ctx = this.engine.audioContext;

    // Synth effects chain
    this.effects.synth = {
      reverb: new Reverb(ctx),
      delay: new Delay(ctx),
      chorus: new Chorus(ctx),
      compressor: new Compressor(ctx),
    };

    // Drum effects
    this.effects.drums = {
      compressor: new Compressor(ctx),
      reverb: new Reverb(ctx),
    };

    // Set default effect params
    this.effects.synth.reverb.setParams({ roomSize: 0.5, damping: 0.5, wet: 0.2 });
    this.effects.synth.delay.setParams({ time: 0.375, feedback: 0.3, wet: 0.15 });
    this.effects.synth.chorus.setParams({ rate: 1.5, depth: 0.005, wet: 0.15 });
    this.effects.drums.compressor.setParams({ threshold: -12, ratio: 4, attack: 0.003, release: 0.1 });
    this.effects.drums.reverb.setParams({ roomSize: 0.3, damping: 0.7, wet: 0.1 });
  }

  _routeAudio() {
    const master = this.engine.masterGain;

    // Synth → chorus → reverb → delay → compressor → master
    this.synth.connect(this.effects.synth.chorus.input);
    this.effects.synth.chorus.connect(this.effects.synth.reverb.input);
    this.effects.synth.reverb.connect(this.effects.synth.delay.input);
    this.effects.synth.delay.connect(this.effects.synth.compressor.input);
    this.effects.synth.compressor.connect(master);

    // Drums → compressor → reverb → master
    this.drumMachine.connect(this.effects.drums.compressor.input);
    this.effects.drums.compressor.connect(this.effects.drums.reverb.input);
    this.effects.drums.reverb.connect(master);
  }

  _buildUI() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = '';

    // Transport bar
    this.ui.transport = new TransportBar(this.engine);
    appEl.appendChild(this.ui.transport.getElement());

    // View tabs
    const viewTabs = this._createViewTabs();
    appEl.appendChild(viewTabs);

    // Main content area
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';

    // Sidebar (presets browser)
    const sidebar = this._createSidebar();
    mainContent.appendChild(sidebar);

    // Editor area (center)
    const editorArea = document.createElement('div');
    editorArea.className = 'editor-area';

    // Step sequencer
    this.ui.sequencer = new StepSequencer(this.engine, this.drumMachine);
    const seqEl = this.ui.sequencer.getElement();
    editorArea.appendChild(seqEl);

    // Piano roll
    this.ui.pianoRoll = new PianoRoll(this.engine, this.synth);
    const prEl = this.ui.pianoRoll.getElement();
    prEl.style.display = 'none';
    editorArea.appendChild(prEl);

    mainContent.appendChild(editorArea);

    // Right panel (synth controls)
    this.ui.synthPanel = new SynthPanel(this.synth, SYNTH_PRESETS);
    mainContent.appendChild(this.ui.synthPanel.getElement());

    appEl.appendChild(mainContent);

    // Mixer panel (bottom)
    this.ui.mixer = new MixerPanel(this.engine);
    appEl.appendChild(this.ui.mixer.getElement());

    // Set up transport callbacks
    this.ui.transport.onPlay(() => this.play());
    this.ui.transport.onStop(() => this.stop());
    this.ui.transport.onBPMChange((bpm) => this.engine.setBPM(bpm));
    this.ui.transport.onSwingChange((swing) => this.engine.setSwing(swing));
  }

  _createViewTabs() {
    const tabs = document.createElement('div');
    tabs.className = 'view-tabs';

    const views = [
      { id: 'sequencer', label: 'Beat Machine' },
      { id: 'pianoroll', label: 'Piano Roll' },
    ];

    views.forEach(view => {
      const tab = document.createElement('div');
      tab.className = 'view-tab' + (view.id === this.state.currentView ? ' active' : '');
      tab.textContent = view.label;
      tab.dataset.view = view.id;
      tab.addEventListener('click', () => this._switchView(view.id));
      tabs.appendChild(tab);
    });

    this._viewTabs = tabs;
    return tabs;
  }

  _createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';

    // Header
    const header = document.createElement('div');
    header.className = 'sidebar-header';
    const h3 = document.createElement('h3');
    h3.textContent = 'Browser';
    header.appendChild(h3);
    sidebar.appendChild(header);

    // Tabs
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'sidebar-tabs';

    const sidebarTabs = [
      { id: 'presets', label: 'Presets' },
      { id: 'patterns', label: 'Patterns' },
    ];

    sidebarTabs.forEach(t => {
      const tab = document.createElement('div');
      tab.className = 'sidebar-tab' + (t.id === 'presets' ? ' active' : '');
      tab.textContent = t.label;
      tab.addEventListener('click', () => {
        tabsDiv.querySelectorAll('.sidebar-tab').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        this._showSidebarContent(t.id);
      });
      tabsDiv.appendChild(tab);
    });

    sidebar.appendChild(tabsDiv);

    // Content
    const content = document.createElement('div');
    content.className = 'sidebar-content';
    content.id = 'sidebar-content';
    sidebar.appendChild(content);

    this._sidebarContent = content;
    this._showSidebarContent('presets');

    return sidebar;
  }

  _showSidebarContent(tab) {
    const content = this._sidebarContent;
    // Clear
    while (content.firstChild) content.removeChild(content.firstChild);

    if (tab === 'presets') {
      // Show synth presets grouped by category
      const categories = Object.entries(SYNTH_PRESETS);
      categories.forEach(([catKey, presets]) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'preset-category';

        const catHeader = document.createElement('div');
        catHeader.className = 'preset-category-header';

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = '\u25BC';
        catHeader.appendChild(arrow);

        const catName = document.createElement('span');
        catName.textContent = catKey.charAt(0).toUpperCase() + catKey.slice(1);
        catHeader.appendChild(catName);

        let collapsed = false;
        catHeader.addEventListener('click', () => {
          collapsed = !collapsed;
          catHeader.classList.toggle('collapsed', collapsed);
          listDiv.style.display = collapsed ? 'none' : 'block';
        });

        catDiv.appendChild(catHeader);

        const listDiv = document.createElement('div');
        presets.forEach(preset => {
          const item = document.createElement('div');
          item.className = 'preset-item';

          const icon = document.createElement('span');
          icon.className = 'preset-icon';
          icon.textContent = this._getPresetIcon(catKey);
          item.appendChild(icon);

          const name = document.createElement('span');
          name.textContent = preset.name;
          item.appendChild(name);

          item.addEventListener('click', () => {
            // Deselect all
            content.querySelectorAll('.preset-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            // Load preset
            this.synth.loadPreset(preset.params);
            if (this.ui.synthPanel) {
              this.ui.synthPanel.loadPreset(preset);
            }
          });

          listDiv.appendChild(item);
        });

        catDiv.appendChild(listDiv);
        content.appendChild(catDiv);
      });
    } else if (tab === 'patterns') {
      // Show drum patterns
      DRUM_PATTERNS.forEach(pattern => {
        const item = document.createElement('div');
        item.className = 'preset-item';

        const icon = document.createElement('span');
        icon.className = 'preset-icon';
        icon.textContent = '\u{1F3B5}';
        item.appendChild(icon);

        const info = document.createElement('div');
        const name = document.createElement('span');
        name.textContent = pattern.name;
        info.appendChild(name);

        const meta = document.createElement('div');
        meta.style.cssText = 'font-size:9px;color:var(--text-tertiary);margin-top:1px;';
        meta.textContent = `${pattern.genre} \u00B7 ${pattern.bpm} BPM`;
        info.appendChild(meta);

        item.appendChild(info);

        item.addEventListener('click', () => {
          content.querySelectorAll('.preset-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          // Load pattern into sequencer
          if (this.ui.sequencer) {
            this.ui.sequencer.loadPattern(pattern);
          }
          // Update BPM to pattern's suggested BPM
          this.engine.setBPM(pattern.bpm);
          this.engine.setSwing(pattern.swing || 0);
          if (this.ui.transport) {
            this.ui.transport.updateBPM(pattern.bpm);
            this.ui.transport.updateSwing(pattern.swing || 0);
          }
        });

        content.appendChild(item);
      });
    }
  }

  _getPresetIcon(category) {
    const icons = {
      leads: '\u{1F3B9}',
      basses: '\u{1F50A}',
      pads: '\u2601',
      keys: '\u{1F3B9}',
      fx: '\u2728',
    };
    return icons[category] || '\u266A';
  }

  _switchView(viewId) {
    this.state.currentView = viewId;

    // Update tabs
    this._viewTabs.querySelectorAll('.view-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewId);
    });

    // Show/hide editors
    const seqEl = this.ui.sequencer.getElement();
    const prEl = this.ui.pianoRoll.getElement();

    if (viewId === 'sequencer') {
      seqEl.style.display = 'flex';
      prEl.style.display = 'none';
    } else {
      seqEl.style.display = 'none';
      prEl.style.display = 'flex';
    }
  }

  _setupScheduler() {
    // The AudioEngine handles timing. We register callbacks for beat events.
    this.engine.onBeat((beatInfo) => {
      this.state.currentStep = beatInfo.step;
      this.state.currentBeat = beatInfo.beat;

      // Trigger drum sounds on this step
      const pattern = this.ui.sequencer.getPattern();
      if (pattern) {
        this._triggerDrumStep(beatInfo.step, beatInfo.time);
      }

      // Trigger piano roll notes on this beat
      if (this.state.currentView === 'pianoroll' || true) {
        this._triggerPianoRollNotes(beatInfo.beat, beatInfo.time, beatInfo.stepDuration);
      }
    });
  }

  _triggerDrumStep(step, time) {
    const pattern = this.ui.sequencer.getPattern();
    if (!pattern) return;

    const instruments = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'tom', 'rimshot', 'cymbal', 'perc'];
    const muteState = this.ui.sequencer.getMuteState();

    instruments.forEach(inst => {
      if (muteState[inst]?.muted) return;

      const velocity = pattern[inst]?.[step];
      if (velocity && velocity > 0) {
        this.drumMachine.trigger(inst, time, velocity);
      }
    });
  }

  _triggerPianoRollNotes(currentBeat, time, stepDuration) {
    const notes = this.ui.pianoRoll.getNotes();
    if (!notes || notes.length === 0) return;

    const tolerance = 0.01;
    notes.forEach(note => {
      if (Math.abs(note.start - currentBeat) < tolerance) {
        const freq = midiToFrequency(note.note);
        const duration = note.duration * stepDuration;
        this.synth.noteOn(note.note, note.velocity, time);
        this.synth.noteOff(note.note, time + duration);
      }
    });
  }

  _loadDefaults() {
    // Load first drum pattern
    if (DRUM_PATTERNS.length > 0) {
      this.ui.sequencer.loadPattern(DRUM_PATTERNS[0]);
      this.engine.setBPM(DRUM_PATTERNS[0].bpm);
      if (this.ui.transport) {
        this.ui.transport.updateBPM(DRUM_PATTERNS[0].bpm);
      }
    }

    // Load first synth preset
    const firstCategory = Object.keys(SYNTH_PRESETS)[0];
    if (firstCategory && SYNTH_PRESETS[firstCategory].length > 0) {
      const preset = SYNTH_PRESETS[firstCategory][0];
      this.synth.loadPreset(preset.params);
      if (this.ui.synthPanel) {
        this.ui.synthPanel.loadPreset(preset);
      }
    }
  }

  _startRenderLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);

      // Update transport display
      if (this.ui.transport) {
        this.ui.transport.update();
      }

      // Update sequencer playhead
      if (this.state.isPlaying && this.ui.sequencer) {
        this.ui.sequencer.update(this.state.currentStep);
      }

      // Update piano roll playhead
      if (this.state.isPlaying && this.ui.pianoRoll) {
        this.ui.pianoRoll.update(this.state.currentBeat);
      }

      // Update mixer meters
      if (this.ui.mixer) {
        this.ui.mixer.update();
      }
    };
    loop();
  }

  _setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Don't capture when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (this.state.isPlaying) {
            this.stop();
          } else {
            this.play();
          }
          break;
        case 'KeyR':
          // Toggle record
          if (this.ui.transport) this.ui.transport.toggleRecord();
          break;
        case 'KeyL':
          // Toggle loop
          if (this.ui.transport) this.ui.transport.toggleLoop();
          break;
        case 'KeyM':
          // Toggle metronome
          if (this.ui.transport) this.ui.transport.toggleMetronome();
          break;
        case 'Digit1':
          this._switchView('sequencer');
          break;
        case 'Digit2':
          this._switchView('pianoroll');
          break;
      }
    });
  }

  play() {
    this.state.isPlaying = true;
    this.engine.play();
    if (this.ui.transport) this.ui.transport.setPlaying(true);
    document.getElementById('app').classList.add('playing');
  }

  stop() {
    this.state.isPlaying = false;
    this.state.currentStep = 0;
    this.state.currentBeat = 0;
    this.engine.stop();
    if (this.ui.transport) this.ui.transport.setPlaying(false);
    if (this.ui.sequencer) this.ui.sequencer.update(-1);
    document.getElementById('app').classList.remove('playing');
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.engine) {
      this.engine.destroy();
    }
  }
}
