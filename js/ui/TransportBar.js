/**
 * NOVA DAW - Transport Bar UI Component
 * Full transport controls: play/stop/pause, record, loop, BPM, time signature,
 * swing, position display, master volume, level meter, metronome.
 */

const TIME_SIGNATURES = [
  { label: '4/4', num: 4, den: 4 },
  { label: '3/4', num: 3, den: 4 },
  { label: '6/8', num: 6, den: 8 },
  { label: '5/4', num: 5, den: 4 },
  { label: '7/8', num: 7, den: 8 },
];

export class TransportBar extends EventTarget {
  /**
   * @param {import('../engine/AudioEngine.js').AudioEngine} engine
   */
  constructor(engine) {
    super();
    this._engine = engine;
    this._recording = false;
    this._loopEnabled = false;
    this._metronomeEnabled = false;
    this._analyser = null;
    this._analyserData = null;

    this._el = document.createElement('div');
    this._el.className = 'transport-bar';

    this._build();
    this._bindKeyboard();
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  _build() {
    // Logo
    const logo = document.createElement('span');
    logo.className = 'logo-small';
    logo.textContent = 'NOVA';
    this._el.appendChild(logo);

    // Transport controls
    this._buildTransportControls();

    // Divider
    this._el.appendChild(this._divider());

    // BPM
    this._buildBpmControl();

    // Time signature
    this._buildTimeSigControl();

    // Swing
    this._buildSwingControl();

    // Divider
    this._el.appendChild(this._divider());

    // Position display
    this._buildPositionDisplay();

    // Divider
    this._el.appendChild(this._divider());

    // Master volume + meter (pushed right via margin-left:auto in CSS)
    this._buildMasterVolume();

    // Master meter
    this._buildMasterMeter();

    // Metronome toggle
    this._buildMetronomeBtn();
  }

  _divider() {
    const d = document.createElement('div');
    d.className = 'transport-divider';
    return d;
  }

  // ── Transport buttons ──

  _buildTransportControls() {
    const wrap = document.createElement('div');
    wrap.className = 'transport-controls';

    // Stop
    this._stopBtn = this._makeBtn('stop-btn', '\u25A0', 'Stop');
    this._stopBtn.addEventListener('click', () => this._handleStop());
    wrap.appendChild(this._stopBtn);

    // Play / Pause
    this._playBtn = this._makeBtn('play-btn', '\u25B6', 'Play (Space)');
    this._playBtn.addEventListener('click', () => this._handlePlayPause());
    wrap.appendChild(this._playBtn);

    // Record
    this._recBtn = this._makeBtn('record-btn', '\u25CF', 'Record (R)');
    this._recBtn.style.color = ''; // will be styled via .active
    this._recBtn.addEventListener('click', () => this._handleRecord());
    wrap.appendChild(this._recBtn);

    // Loop
    this._loopBtn = this._makeBtn('loop-btn', '\u21BB', 'Loop (L)');
    this._loopBtn.addEventListener('click', () => this._handleLoop());
    wrap.appendChild(this._loopBtn);

    this._el.appendChild(wrap);
  }

  _makeBtn(extraClass, symbol, title) {
    const btn = document.createElement('button');
    btn.className = 'transport-btn ' + extraClass;
    btn.textContent = symbol;
    btn.title = title;
    return btn;
  }

  _handlePlayPause() {
    this._ensureInit();
    const state = this._engine.state;
    if (state === 'playing') {
      this._engine.pause();
      this._playBtn.classList.remove('active');
    } else {
      this._engine.play();
      this._playBtn.classList.add('active');
    }
    this._emit('transportChange', { state: this._engine.state });
  }

  _handleStop() {
    this._engine.stop();
    this._playBtn.classList.remove('active');
    this._updatePositionDisplay(0);
    this._emit('transportChange', { state: 'stopped' });
  }

  _handleRecord() {
    this._recording = !this._recording;
    this._recBtn.classList.toggle('active', this._recording);
    this._el.classList.toggle('recording', this._recording);
    this._emit('recordChange', { recording: this._recording });
  }

  _handleLoop() {
    this._loopEnabled = !this._loopEnabled;
    this._engine.loopEnabled = this._loopEnabled;
    this._loopBtn.classList.toggle('active', this._loopEnabled);
    this._emit('loopChange', { loop: this._loopEnabled });
  }

  // ── BPM ──

  _buildBpmControl() {
    const wrap = document.createElement('div');
    wrap.className = 'bpm-control';

    const label = document.createElement('label');
    label.textContent = 'BPM';
    wrap.appendChild(label);

    this._bpmInput = document.createElement('input');
    this._bpmInput.type = 'number';
    this._bpmInput.min = 40;
    this._bpmInput.max = 300;
    this._bpmInput.value = this._engine.bpm;
    this._bpmInput.step = 1;

    // Typed input
    this._bpmInput.addEventListener('change', () => {
      const v = Math.round(Math.max(40, Math.min(300, Number(this._bpmInput.value) || 120)));
      this._bpmInput.value = v;
      this._engine.bpm = v;
      this._emit('bpmChange', { bpm: v });
    });

    // Scroll wheel
    this._bpmInput.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const v = Math.round(Math.max(40, Math.min(300, this._engine.bpm + delta)));
      this._bpmInput.value = v;
      this._engine.bpm = v;
      this._emit('bpmChange', { bpm: v });
    });

    // Click-drag
    let dragStartY = 0;
    let dragStartBpm = 0;
    const onDragMove = (e) => {
      const diff = dragStartY - e.clientY;
      const v = Math.round(Math.max(40, Math.min(300, dragStartBpm + diff * 0.5)));
      this._bpmInput.value = v;
      this._engine.bpm = v;
    };
    const onDragUp = () => {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragUp);
      this._emit('bpmChange', { bpm: this._engine.bpm });
    };
    this._bpmInput.addEventListener('mousedown', (e) => {
      // Only drag when not focused (allow normal editing when focused)
      if (document.activeElement === this._bpmInput) return;
      e.preventDefault();
      dragStartY = e.clientY;
      dragStartBpm = this._engine.bpm;
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragUp);
    });

    wrap.appendChild(this._bpmInput);
    this._el.appendChild(wrap);
  }

  // ── Time Signature ──

  _buildTimeSigControl() {
    const wrap = document.createElement('div');
    wrap.className = 'time-sig-control';

    this._timeSigSelect = document.createElement('select');
    for (const ts of TIME_SIGNATURES) {
      const opt = document.createElement('option');
      opt.value = ts.num + '/' + ts.den;
      opt.textContent = ts.label;
      this._timeSigSelect.appendChild(opt);
    }
    this._timeSigSelect.value = '4/4';

    this._timeSigSelect.addEventListener('change', () => {
      const [num, den] = this._timeSigSelect.value.split('/').map(Number);
      this._engine.setTimeSignature(num, den);
      this._emit('timeSigChange', { numerator: num, denominator: den });
    });

    wrap.appendChild(this._timeSigSelect);
    this._el.appendChild(wrap);
  }

  // ── Swing ──

  _buildSwingControl() {
    const wrap = document.createElement('div');
    wrap.className = 'swing-control';

    const label = document.createElement('label');
    label.textContent = 'SWING';
    wrap.appendChild(label);

    this._swingSlider = document.createElement('input');
    this._swingSlider.type = 'range';
    this._swingSlider.min = 0;
    this._swingSlider.max = 100;
    this._swingSlider.value = Math.round(this._engine.swing * 100);

    this._swingValue = document.createElement('span');
    this._swingValue.className = 'swing-value';
    this._swingValue.textContent = this._swingSlider.value + '%';

    this._swingSlider.addEventListener('input', () => {
      const v = Number(this._swingSlider.value);
      this._swingValue.textContent = v + '%';
      this._engine.swing = v / 100;
      this._emit('swingChange', { swing: v });
    });

    wrap.appendChild(this._swingSlider);
    wrap.appendChild(this._swingValue);
    this._el.appendChild(wrap);
  }

  // ── Position Display ──

  _buildPositionDisplay() {
    this._positionEl = document.createElement('div');
    this._positionEl.className = 'position-display';
    this._positionEl.textContent = '001:1:000';
    this._el.appendChild(this._positionEl);
  }

  _updatePositionDisplay(beatPos) {
    const ts = this._engine.timeSignature;
    const beatsPerBar = ts.numerator;
    const totalBeats = Math.max(0, beatPos);
    const bar = Math.floor(totalBeats / beatsPerBar) + 1;
    const beat = Math.floor(totalBeats % beatsPerBar) + 1;
    const tick = Math.round((totalBeats % 1) * 960); // 960 PPQN standard
    const barStr = String(bar).padStart(3, '0');
    const beatStr = String(beat);
    const tickStr = String(tick).padStart(3, '0');
    this._positionEl.textContent = barStr + ':' + beatStr + ':' + tickStr;
  }

  // ── Master Volume ──

  _buildMasterVolume() {
    const wrap = document.createElement('div');
    wrap.className = 'master-volume';

    const label = document.createElement('label');
    label.textContent = 'MASTER';
    wrap.appendChild(label);

    this._volSlider = document.createElement('input');
    this._volSlider.type = 'range';
    this._volSlider.min = 0;
    this._volSlider.max = 100;
    this._volSlider.value = 80; // default 0.8

    this._volDisplay = document.createElement('span');
    this._volDisplay.className = 'vol-value';
    this._volDisplay.textContent = this._linearToDb(0.8);

    this._volSlider.addEventListener('input', () => {
      const lin = Number(this._volSlider.value) / 100;
      this._engine.masterVolume = lin;
      this._volDisplay.textContent = this._linearToDb(lin);
      this._emit('volumeChange', { volume: lin });
    });

    wrap.appendChild(this._volSlider);
    wrap.appendChild(this._volDisplay);
    this._el.appendChild(wrap);
  }

  _linearToDb(value) {
    if (value <= 0) return '-inf';
    const db = 20 * Math.log10(value);
    return db.toFixed(1) + 'dB';
  }

  // ── Master Meter ──

  _buildMasterMeter() {
    const wrap = document.createElement('div');
    wrap.className = 'master-meter';

    this._meterFill = document.createElement('div');
    this._meterFill.className = 'meter-fill';
    wrap.appendChild(this._meterFill);

    this._el.appendChild(wrap);
  }

  _ensureAnalyser() {
    if (this._analyser) return;
    const ctx = this._engine.context;
    if (!ctx) return;
    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = 256;
    this._analyserData = new Float32Array(this._analyser.fftSize);
    // Tap the master output
    const master = this._engine.masterOutput;
    if (master) {
      master.connect(this._analyser);
    }
  }

  _updateMeter() {
    if (!this._analyser) return;
    this._analyser.getFloatTimeDomainData(this._analyserData);
    let peak = 0;
    for (let i = 0; i < this._analyserData.length; i++) {
      const abs = Math.abs(this._analyserData[i]);
      if (abs > peak) peak = abs;
    }
    const pct = Math.min(100, peak * 100);
    this._meterFill.style.width = pct + '%';
  }

  // ── Metronome ──

  _buildMetronomeBtn() {
    this._metronomeBtn = this._makeBtn('metronome-btn', '\u{1D15E}', 'Metronome (M)');
    // Use a simple text label since the musical symbol may not render everywhere
    this._metronomeBtn.textContent = '\u266A';
    this._metronomeBtn.addEventListener('click', () => this._handleMetronome());
    this._el.appendChild(this._metronomeBtn);
  }

  _handleMetronome() {
    this._metronomeEnabled = !this._metronomeEnabled;
    this._metronomeBtn.classList.toggle('active', this._metronomeEnabled);
    this._emit('metronomeChange', { enabled: this._metronomeEnabled });
  }

  // ── Keyboard shortcuts ──

  _bindKeyboard() {
    this._keyHandler = (e) => {
      // Don't intercept when user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this._handlePlayPause();
          break;
        case 'KeyR':
          this._handleRecord();
          break;
        case 'KeyL':
          this._handleLoop();
          break;
        case 'KeyM':
          this._handleMetronome();
          break;
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  // ── Helpers ──

  async _ensureInit() {
    try {
      await this._engine.init();
      this._ensureAnalyser();
    } catch (_) {
      // already initialised
    }
  }

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** @returns {HTMLElement} */
  getElement() {
    return this._el;
  }

  /**
   * Call on requestAnimationFrame to update meters and position.
   */
  update() {
    // Position
    if (this._engine.state === 'playing') {
      this._updatePositionDisplay(this._engine.currentBeat);
      this._el.classList.add('playing');
    } else {
      this._el.classList.remove('playing');
    }

    // Meter
    this._updateMeter();
  }

  /** Clean up event listeners. */
  destroy() {
    document.removeEventListener('keydown', this._keyHandler);
  }

  /** @returns {boolean} */
  get isRecording() {
    return this._recording;
  }

  /** @returns {boolean} */
  get isMetronomeEnabled() {
    return this._metronomeEnabled;
  }
}

export default TransportBar;
