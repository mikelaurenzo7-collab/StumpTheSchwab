export default class MIDIManager {
  constructor() {
    this._access = null;
    this._activeInputs = new Map();
    this._lastActivity = 0;

    this._callbacks = {
      noteOn: [],
      noteOff: [],
      cc: [],
      pitchBend: [],
      programChange: [],
      deviceChange: [],
      learnComplete: [],
      mappedCC: [],
    };

    this._learning = false;
    this._learnTarget = null;
    this._ccMappings = {};

    this._onStateChange = this._handleStateChange.bind(this);
    this._onMessage = this._handleMessage.bind(this);
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      return false;
    }
    try {
      this._access = await navigator.requestMIDIAccess({ sysex: false });
      this._access.addEventListener('statechange', this._onStateChange);
      return true;
    } catch {
      return false;
    }
  }

  // ── Device Management ──────────────────────────────────────────────

  getInputs() {
    if (!this._access) return [];
    return Array.from(this._access.inputs.values()).map((inp) => ({
      id: inp.id,
      name: inp.name,
      manufacturer: inp.manufacturer,
      state: inp.state,
    }));
  }

  getOutputs() {
    if (!this._access) return [];
    return Array.from(this._access.outputs.values()).map((out) => ({
      id: out.id,
      name: out.name,
      manufacturer: out.manufacturer,
      state: out.state,
    }));
  }

  selectInput(id) {
    if (!this._access || this._activeInputs.has(id)) return;
    const input = this._access.inputs.get(id);
    if (!input) return;
    input.addEventListener('midimessage', this._onMessage);
    this._activeInputs.set(id, input);
  }

  selectAllInputs() {
    if (!this._access) return;
    for (const input of this._access.inputs.values()) {
      if (!this._activeInputs.has(input.id)) {
        input.addEventListener('midimessage', this._onMessage);
        this._activeInputs.set(input.id, input);
      }
    }
  }

  deselectInput(id) {
    const input = this._activeInputs.get(id);
    if (!input) return;
    input.removeEventListener('midimessage', this._onMessage);
    this._activeInputs.delete(id);
  }

  // ── Callbacks ──────────────────────────────────────────────────────

  onNoteOn(cb) { this._callbacks.noteOn.push(cb); }
  onNoteOff(cb) { this._callbacks.noteOff.push(cb); }
  onCC(cb) { this._callbacks.cc.push(cb); }
  onPitchBend(cb) { this._callbacks.pitchBend.push(cb); }
  onProgramChange(cb) { this._callbacks.programChange.push(cb); }
  onDeviceChange(cb) { this._callbacks.deviceChange.push(cb); }
  onLearnComplete(cb) { this._callbacks.learnComplete.push(cb); }
  onMappedCC(cb) { this._callbacks.mappedCC.push(cb); }

  // ── MIDI Learn ─────────────────────────────────────────────────────

  startLearn(targetParam) {
    this._learning = true;
    this._learnTarget = targetParam;
  }

  stopLearn() {
    this._learning = false;
    this._learnTarget = null;
  }

  isLearning() {
    return this._learning;
  }

  getMappings() {
    return { ...this._ccMappings };
  }

  clearMappings() {
    this._ccMappings = {};
  }

  // ── Activity ───────────────────────────────────────────────────────

  getLastActivity() {
    return this._lastActivity;
  }

  isActive() {
    return performance.now() - this._lastActivity < 500;
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  dispose() {
    for (const [id, input] of this._activeInputs) {
      input.removeEventListener('midimessage', this._onMessage);
    }
    this._activeInputs.clear();

    if (this._access) {
      this._access.removeEventListener('statechange', this._onStateChange);
    }

    for (const key of Object.keys(this._callbacks)) {
      this._callbacks[key] = [];
    }

    this._learning = false;
    this._learnTarget = null;
    this._ccMappings = {};
    this._access = null;
  }

  // ── Internal ───────────────────────────────────────────────────────

  _handleStateChange() {
    this._fire('deviceChange');
  }

  _handleMessage(event) {
    const [status, data1, data2] = event.data;
    this._lastActivity = performance.now();

    const type = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    switch (type) {
      case 0x90: {
        if (data2 === 0) {
          this._fire('noteOff', data1, channel);
        } else {
          this._fire('noteOn', data1, data2 / 127, channel);
        }
        break;
      }
      case 0x80: {
        this._fire('noteOff', data1, channel);
        break;
      }
      case 0xb0: {
        const ccNum = data1;
        const normValue = data2 / 127;

        if (this._learning) {
          this._ccMappings[ccNum] = this._learnTarget;
          this._fire('learnComplete', ccNum, this._learnTarget);
          this._learning = false;
          this._learnTarget = null;
        }

        this._fire('cc', ccNum, normValue, channel);

        if (this._ccMappings[ccNum] !== undefined) {
          this._fire('mappedCC', this._ccMappings[ccNum], normValue);
        }
        break;
      }
      case 0xe0: {
        const raw = data1 | (data2 << 7);
        const normalized = (raw - 8192) / 8192;
        this._fire('pitchBend', normalized, channel);
        break;
      }
      case 0xc0: {
        this._fire('programChange', data1, channel);
        break;
      }
    }
  }

  _fire(type, ...args) {
    for (const cb of this._callbacks[type]) {
      cb(...args);
    }
  }
}
