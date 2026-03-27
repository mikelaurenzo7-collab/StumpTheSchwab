export default class TransportBar {
  constructor(container) {
    this.container = container;
    this.bpm = 120;
    this.isPlaying = false;
    this.metronomeOn = false;
    this.currentBeat = 0;
    this.tapTimes = [];

    // Callbacks
    this._onPlay = null;
    this._onStop = null;
    this._onBpmChange = null;
    this._onTimeSignatureChange = null;
    this._onMetronomeToggle = null;
    this._onMasterVolumeChange = null;

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    const inner = document.createElement('div');
    inner.className = 'transport-inner';

    // Logo
    const logo = document.createElement('div');
    logo.className = 'transport-logo';
    logo.textContent = 'NOVA';
    inner.appendChild(logo);

    // Transport Controls
    const controls = document.createElement('div');
    controls.className = 'transport-controls';

    // Stop button
    this.btnStop = document.createElement('button');
    this.btnStop.className = 'transport-btn';
    this.btnStop.id = 'btn-stop';
    this.btnStop.title = 'Stop';
    this.btnStop.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" fill="currentColor"/></svg>`;
    controls.appendChild(this.btnStop);

    // Play button
    this.btnPlay = document.createElement('button');
    this.btnPlay.className = 'transport-btn btn-play';
    this.btnPlay.id = 'btn-play';
    this.btnPlay.title = 'Play';
    this.btnPlay.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="2,0 14,7 2,14" fill="currentColor"/></svg>`;
    controls.appendChild(this.btnPlay);

    // Record button
    this.btnRecord = document.createElement('button');
    this.btnRecord.className = 'transport-btn btn-record';
    this.btnRecord.id = 'btn-record';
    this.btnRecord.title = 'Record';
    this.btnRecord.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="currentColor"/></svg>`;
    controls.appendChild(this.btnRecord);

    inner.appendChild(controls);

    // BPM Control
    const bpmSection = document.createElement('div');
    bpmSection.className = 'transport-bpm';

    const bpmLabel = document.createElement('label');
    bpmLabel.className = 'transport-label';
    bpmLabel.textContent = 'BPM';
    bpmSection.appendChild(bpmLabel);

    const bpmControl = document.createElement('div');
    bpmControl.className = 'bpm-control';

    this.bpmDown = document.createElement('button');
    this.bpmDown.className = 'bpm-btn';
    this.bpmDown.id = 'bpm-down';
    this.bpmDown.textContent = '-';
    bpmControl.appendChild(this.bpmDown);

    this.bpmInput = document.createElement('input');
    this.bpmInput.type = 'number';
    this.bpmInput.id = 'bpm-input';
    this.bpmInput.value = '120';
    this.bpmInput.min = '20';
    this.bpmInput.max = '300';
    this.bpmInput.className = 'bpm-input';
    bpmControl.appendChild(this.bpmInput);

    this.bpmUp = document.createElement('button');
    this.bpmUp.className = 'bpm-btn';
    this.bpmUp.id = 'bpm-up';
    this.bpmUp.textContent = '+';
    bpmControl.appendChild(this.bpmUp);

    bpmSection.appendChild(bpmControl);

    this.tapTempoBtn = document.createElement('button');
    this.tapTempoBtn.className = 'tap-tempo-btn';
    this.tapTempoBtn.id = 'tap-tempo';
    this.tapTempoBtn.textContent = 'TAP';
    bpmSection.appendChild(this.tapTempoBtn);

    inner.appendChild(bpmSection);

    // Time Signature
    const timeSigSection = document.createElement('div');
    timeSigSection.className = 'transport-time-sig';

    const timeSigLabel = document.createElement('label');
    timeSigLabel.className = 'transport-label';
    timeSigLabel.textContent = 'TIME';
    timeSigSection.appendChild(timeSigLabel);

    this.timeSigSelect = document.createElement('select');
    this.timeSigSelect.id = 'time-sig';
    this.timeSigSelect.className = 'time-sig-select';

    const signatures = ['4/4', '3/4', '6/8'];
    for (const sig of signatures) {
      const option = document.createElement('option');
      option.value = sig;
      option.textContent = sig;
      this.timeSigSelect.appendChild(option);
    }
    timeSigSection.appendChild(this.timeSigSelect);

    inner.appendChild(timeSigSection);

    // Beat Indicators
    this.beatIndicators = document.createElement('div');
    this.beatIndicators.className = 'beat-indicators';
    this.beatIndicators.id = 'beat-indicators';
    this.beatDots = [];

    for (let i = 0; i < 4; i++) {
      const dot = document.createElement('div');
      dot.className = 'beat-dot';
      dot.dataset.beat = i;
      this.beatIndicators.appendChild(dot);
      this.beatDots.push(dot);
    }

    inner.appendChild(this.beatIndicators);

    // Metronome Toggle
    this.btnMetronome = document.createElement('button');
    this.btnMetronome.className = 'transport-btn metronome-btn';
    this.btnMetronome.id = 'btn-metronome';
    this.btnMetronome.title = 'Metronome';
    this.btnMetronome.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 3,15 13,15" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="4" x2="12" y2="8" stroke="currentColor" stroke-width="1.5"/></svg>`;
    inner.appendChild(this.btnMetronome);

    // Master Volume
    const masterSection = document.createElement('div');
    masterSection.className = 'transport-master';

    const masterLabel = document.createElement('label');
    masterLabel.className = 'transport-label';
    masterLabel.textContent = 'MASTER';
    masterSection.appendChild(masterLabel);

    this.masterSlider = document.createElement('input');
    this.masterSlider.type = 'range';
    this.masterSlider.id = 'master-volume';
    this.masterSlider.min = '0';
    this.masterSlider.max = '100';
    this.masterSlider.value = '80';
    this.masterSlider.className = 'master-slider';
    masterSection.appendChild(this.masterSlider);

    this.masterValue = document.createElement('span');
    this.masterValue.id = 'master-value';
    this.masterValue.className = 'master-value';
    this.masterValue.textContent = '80%';
    masterSection.appendChild(this.masterValue);

    inner.appendChild(masterSection);

    this.container.appendChild(inner);
  }

  _bindEvents() {
    // Play button
    this.btnPlay.addEventListener('click', () => {
      if (this.isPlaying) {
        this.setPlaying(false);
        if (this._onStop) this._onStop();
      } else {
        this.setPlaying(true);
        if (this._onPlay) this._onPlay();
      }
    });

    // Stop button
    this.btnStop.addEventListener('click', () => {
      this.setPlaying(false);
      this.resetBeat();
      if (this._onStop) this._onStop();
    });

    // BPM input change
    this.bpmInput.addEventListener('change', () => {
      let val = parseInt(this.bpmInput.value, 10);
      val = Math.max(20, Math.min(300, val));
      this.bpmInput.value = val;
      this.bpm = val;
      if (this._onBpmChange) this._onBpmChange(val);
    });

    // BPM down button
    this.bpmDown.addEventListener('click', (e) => {
      const delta = e.shiftKey ? 10 : 1;
      const val = Math.max(20, this.bpm - delta);
      this.setBPM(val);
      if (this._onBpmChange) this._onBpmChange(val);
    });

    // BPM up button
    this.bpmUp.addEventListener('click', (e) => {
      const delta = e.shiftKey ? 10 : 1;
      const val = Math.min(300, this.bpm + delta);
      this.setBPM(val);
      if (this._onBpmChange) this._onBpmChange(val);
    });

    // Tap tempo
    this.tapTempoBtn.addEventListener('click', () => {
      this._onTap();
    });

    // Time signature
    this.timeSigSelect.addEventListener('change', () => {
      if (this._onTimeSignatureChange) {
        this._onTimeSignatureChange(this.timeSigSelect.value);
      }
    });

    // Metronome toggle
    this.btnMetronome.addEventListener('click', () => {
      this.metronomeOn = !this.metronomeOn;
      this.btnMetronome.classList.toggle('active', this.metronomeOn);
      if (this._onMetronomeToggle) this._onMetronomeToggle(this.metronomeOn);
    });

    // Master volume
    this.masterSlider.addEventListener('input', () => {
      const val = parseInt(this.masterSlider.value, 10);
      this.masterValue.textContent = val + '%';
      if (this._onMasterVolumeChange) this._onMasterVolumeChange(val / 100);
    });
  }

  _onTap() {
    const now = performance.now();
    this.tapTimes.push(now);
    if (this.tapTimes.length > 5) this.tapTimes.shift();
    if (this.tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const bpm = Math.round(60000 / avgInterval);
      if (bpm >= 20 && bpm <= 300) {
        this.setBPM(bpm);
        if (this._onBpmChange) this._onBpmChange(bpm);
      }
    }
    // Reset if gap > 2 seconds
    setTimeout(() => {
      if (performance.now() - now > 2000) this.tapTimes = [];
    }, 2500);
  }

  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;
    this.btnPlay.classList.toggle('active', isPlaying);
    if (!isPlaying) {
      this.resetBeat();
    }
  }

  setBPM(bpm) {
    bpm = Math.max(20, Math.min(300, bpm));
    this.bpm = bpm;
    this.bpmInput.value = bpm;
  }

  setBeat(beatIndex) {
    this.currentBeat = beatIndex;
    for (let i = 0; i < this.beatDots.length; i++) {
      this.beatDots[i].classList.toggle('active', i === beatIndex);
    }
  }

  resetBeat() {
    this.currentBeat = 0;
    for (const dot of this.beatDots) {
      dot.classList.remove('active');
    }
  }

  onPlay(callback) {
    this._onPlay = callback;
  }

  onStop(callback) {
    this._onStop = callback;
  }

  onBpmChange(callback) {
    this._onBpmChange = callback;
  }

  onTimeSignatureChange(callback) {
    this._onTimeSignatureChange = callback;
  }

  onMetronomeToggle(callback) {
    this._onMetronomeToggle = callback;
  }

  onMasterVolumeChange(callback) {
    this._onMasterVolumeChange = callback;
  }
}
