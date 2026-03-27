export default class MixerPanel {
    constructor(container) {
        this.container = container;

        this.channels = [
            { name: 'SYNTH 1', type: 'synth', volume: 0.8, pan: 0, muted: false, solo: false },
            { name: 'SYNTH 2', type: 'synth', volume: 0.8, pan: 0, muted: false, solo: false },
            { name: 'SYNTH 3', type: 'synth', volume: 0.8, pan: 0, muted: false, solo: false },
            { name: 'SYNTH 4', type: 'synth', volume: 0.8, pan: 0, muted: false, solo: false },
            { name: 'DRUMS 1', type: 'drum', volume: 0.8, pan: 0, muted: false, solo: false },
            { name: 'DRUMS 2', type: 'drum', volume: 0.8, pan: 0, muted: false, solo: false },
            { name: 'DRUMS 3', type: 'drum', volume: 0.8, pan: 0, muted: false, solo: false },
            { name: 'DRUMS 4', type: 'drum', volume: 0.8, pan: 0, muted: false, solo: false }
        ];
        this.master = { volume: 0.8, muted: false };

        this._onVolumeChange = null;
        this._onPanChange = null;
        this._onMuteToggle = null;
        this._onSoloToggle = null;
        this._onSendChange = null;
        this._onMasterVolumeChange = null;

        this._meterCanvases = [];
        this._masterMeterCanvas = null;
        this._faders = [];
        this._panSliders = [];
        this._labels = [];
        this._masterFader = null;
        this._animFrame = null;

        this._buildDOM();
        this._injectStyles();
        this.startMeterAnimation();
    }

    _buildDOM() {
        const mixerContainer = document.createElement('div');
        mixerContainer.className = 'mixer-container';

        // Header
        const header = document.createElement('div');
        header.className = 'mixer-header';
        const title = document.createElement('span');
        title.className = 'mixer-title';
        title.textContent = 'MIXER';
        header.appendChild(title);
        mixerContainer.appendChild(header);

        // Channels wrapper
        const channelsWrapper = document.createElement('div');
        channelsWrapper.className = 'mixer-channels';

        // Build each channel strip
        this.channels.forEach((ch, i) => {
            const strip = this._buildChannelStrip(ch, i);
            channelsWrapper.appendChild(strip);
        });

        // Master strip
        const masterStrip = this._buildMasterStrip();
        channelsWrapper.appendChild(masterStrip);

        mixerContainer.appendChild(channelsWrapper);
        this.container.appendChild(mixerContainer);
    }

    _buildChannelStrip(channel, index) {
        const strip = document.createElement('div');
        strip.className = 'channel-strip';
        strip.dataset.channel = index;

        // Label
        const label = document.createElement('div');
        label.className = 'channel-label';
        label.textContent = channel.name;
        this._labels[index] = label;
        strip.appendChild(label);

        // Level meter canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'level-meter';
        canvas.width = 12;
        canvas.height = 100;
        this._meterCanvases[index] = canvas;
        strip.appendChild(canvas);

        // Fader container
        const faderContainer = document.createElement('div');
        faderContainer.className = 'fader-container';
        const fader = document.createElement('input');
        fader.type = 'range';
        fader.className = 'fader';
        fader.setAttribute('orient', 'vertical');
        fader.min = 0;
        fader.max = 100;
        fader.value = Math.round(channel.volume * 100);
        this._faders[index] = fader;

        fader.addEventListener('input', () => {
            const val = parseInt(fader.value, 10) / 100;
            this.channels[index].volume = val;
            if (this._onVolumeChange) this._onVolumeChange(index, val);
        });

        faderContainer.appendChild(fader);
        strip.appendChild(faderContainer);

        // Channel controls (pan + buttons)
        const controls = document.createElement('div');
        controls.className = 'channel-controls';

        // Pan control
        const panControl = document.createElement('div');
        panControl.className = 'pan-control';
        const panLabel = document.createElement('label');
        panLabel.className = 'pan-label';
        panLabel.textContent = 'PAN';
        panControl.appendChild(panLabel);

        const panKnob = document.createElement('input');
        panKnob.type = 'range';
        panKnob.className = 'pan-knob';
        panKnob.min = -100;
        panKnob.max = 100;
        panKnob.value = Math.round(channel.pan * 100);
        this._panSliders[index] = panKnob;

        panKnob.addEventListener('input', () => {
            const val = parseInt(panKnob.value, 10) / 100;
            this.channels[index].pan = val;
            if (this._onPanChange) this._onPanChange(index, val);
        });

        panControl.appendChild(panKnob);
        controls.appendChild(panControl);

        // Buttons
        const buttons = document.createElement('div');
        buttons.className = 'channel-buttons';

        const soloBtn = document.createElement('button');
        soloBtn.className = 'ch-btn solo-btn';
        soloBtn.dataset.channel = index;
        soloBtn.textContent = 'S';
        soloBtn.addEventListener('click', () => {
            this.channels[index].solo = !this.channels[index].solo;
            soloBtn.classList.toggle('active', this.channels[index].solo);
            if (this._onSoloToggle) this._onSoloToggle(index, this.channels[index].solo);
        });

        const muteBtn = document.createElement('button');
        muteBtn.className = 'ch-btn mute-btn';
        muteBtn.dataset.channel = index;
        muteBtn.textContent = 'M';
        muteBtn.addEventListener('click', () => {
            this.channels[index].muted = !this.channels[index].muted;
            muteBtn.classList.toggle('active', this.channels[index].muted);
            if (this._onMuteToggle) this._onMuteToggle(index, this.channels[index].muted);
        });

        buttons.appendChild(soloBtn);
        buttons.appendChild(muteBtn);
        controls.appendChild(buttons);
        strip.appendChild(controls);

        // Send controls
        const sendControls = document.createElement('div');
        sendControls.className = 'send-controls';

        const sends = [
            { label: 'REV', type: 'reverb' },
            { label: 'DLY', type: 'delay' }
        ];

        sends.forEach(send => {
            const group = document.createElement('div');
            group.className = 'send-knob-group';

            const sendLabel = document.createElement('label');
            sendLabel.textContent = send.label;
            group.appendChild(sendLabel);

            const sendKnob = document.createElement('input');
            sendKnob.type = 'range';
            sendKnob.className = 'send-knob';
            sendKnob.dataset.send = send.type;
            sendKnob.min = 0;
            sendKnob.max = 100;
            sendKnob.value = 0;

            sendKnob.addEventListener('input', () => {
                const val = parseInt(sendKnob.value, 10) / 100;
                if (this._onSendChange) this._onSendChange(index, send.type, val);
            });

            group.appendChild(sendKnob);
            sendControls.appendChild(group);
        });

        strip.appendChild(sendControls);

        return strip;
    }

    _buildMasterStrip() {
        const strip = document.createElement('div');
        strip.className = 'channel-strip master-strip';

        // Label
        const label = document.createElement('div');
        label.className = 'channel-label master-label';
        label.textContent = 'MASTER';
        strip.appendChild(label);

        // Level meter canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'level-meter master-meter';
        canvas.width = 20;
        canvas.height = 100;
        this._masterMeterCanvas = canvas;
        strip.appendChild(canvas);

        // Fader
        const faderContainer = document.createElement('div');
        faderContainer.className = 'fader-container';
        const fader = document.createElement('input');
        fader.type = 'range';
        fader.className = 'fader master-fader';
        fader.setAttribute('orient', 'vertical');
        fader.min = 0;
        fader.max = 100;
        fader.value = Math.round(this.master.volume * 100);
        this._masterFader = fader;

        fader.addEventListener('input', () => {
            const val = parseInt(fader.value, 10) / 100;
            this.master.volume = val;
            if (this._onMasterVolumeChange) this._onMasterVolumeChange(val);
        });

        faderContainer.appendChild(fader);
        strip.appendChild(faderContainer);

        return strip;
    }

    _injectStyles() {
        if (document.getElementById('mixer-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'mixer-panel-styles';
        style.textContent = `
            .mixer-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #0d0d14;
                border-left: 1px solid #1a1a2e;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
            }

            .mixer-header {
                padding: 6px 8px;
                border-bottom: 1px solid #1a1a2e;
                flex-shrink: 0;
            }

            .mixer-title {
                font-size: 10px;
                font-weight: bold;
                color: #8888aa;
                letter-spacing: 2px;
            }

            .mixer-channels {
                display: flex;
                flex-direction: row;
                padding: 4px;
                gap: 2px;
                flex: 1;
                overflow-x: auto;
            }

            .channel-strip {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 28px;
                min-width: 28px;
                gap: 4px;
                padding: 4px 0;
                border-right: 1px solid #14141f;
            }

            .master-strip {
                width: 36px;
                min-width: 36px;
                border-left: 2px solid #ffaa00;
                border-right: none;
                padding-left: 4px;
            }

            .channel-label {
                font-size: 10px;
                color: #6666aa;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                writing-mode: vertical-rl;
                text-orientation: mixed;
                transform: rotate(180deg);
                height: 48px;
                line-height: 1;
                letter-spacing: 1px;
            }

            .master-label {
                color: #ffaa00;
                font-weight: bold;
            }

            .level-meter {
                display: block;
                border-radius: 1px;
            }

            .fader-container {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100px;
            }

            .fader {
                -webkit-appearance: slider-vertical;
                appearance: slider-vertical;
                width: 14px;
                height: 90px;
                background: transparent;
                cursor: pointer;
            }

            .fader::-webkit-slider-runnable-track {
                width: 4px;
                background: #1a1a2e;
                border-radius: 2px;
            }

            .fader::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 12px;
                height: 6px;
                background: #6666cc;
                border-radius: 1px;
                cursor: pointer;
            }

            .master-fader::-webkit-slider-thumb {
                background: #ffaa00;
            }

            .channel-controls {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 3px;
                width: 100%;
            }

            .pan-control {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1px;
            }

            .pan-label {
                font-size: 8px;
                color: #555577;
            }

            .pan-knob {
                -webkit-appearance: none;
                appearance: none;
                width: 24px;
                height: 8px;
                background: #1a1a2e;
                border-radius: 4px;
                outline: none;
                cursor: pointer;
            }

            .pan-knob::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 6px;
                height: 8px;
                background: #8888cc;
                border-radius: 1px;
                cursor: pointer;
            }

            .channel-buttons {
                display: flex;
                gap: 1px;
            }

            .ch-btn {
                width: 13px;
                height: 13px;
                font-size: 8px;
                font-weight: bold;
                border: 1px solid #333355;
                background: #14141f;
                color: #555577;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                border-radius: 1px;
                font-family: 'Courier New', monospace;
            }

            .ch-btn:hover {
                border-color: #5555aa;
            }

            .solo-btn.active {
                background: #ffaa00;
                color: #000;
                border-color: #ffaa00;
            }

            .mute-btn.active {
                background: #ff3366;
                color: #000;
                border-color: #ff3366;
            }

            .send-controls {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                width: 100%;
            }

            .send-knob-group {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0;
            }

            .send-knob-group label {
                font-size: 7px;
                color: #444466;
                letter-spacing: 1px;
            }

            .send-knob {
                -webkit-appearance: none;
                appearance: none;
                width: 24px;
                height: 6px;
                background: #1a1a2e;
                border-radius: 3px;
                outline: none;
                cursor: pointer;
            }

            .send-knob::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 5px;
                height: 6px;
                background: #666688;
                border-radius: 1px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }

    drawMeter(canvas, level) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, w, h);

        // Meter segments (draw from bottom up)
        const meterHeight = level * h;
        const gradient = ctx.createLinearGradient(0, h, 0, 0);
        gradient.addColorStop(0, '#00ff88');
        gradient.addColorStop(0.7, '#ffaa00');
        gradient.addColorStop(1, '#ff3366');

        ctx.fillStyle = gradient;
        ctx.fillRect(1, h - meterHeight, w - 2, meterHeight);

        // Segmented look: horizontal lines every 4px
        ctx.fillStyle = '#0a0a12';
        for (let y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 1);
        }
    }

    startMeterAnimation() {
        this._meterLevels = new Array(9).fill(0);
        this._peakLevels = new Array(9).fill(0);

        const animate = () => {
            // Smooth falloff
            for (let i = 0; i < 9; i++) {
                this._peakLevels[i] *= 0.95;
            }
            // Draw all channel meters
            this.channels.forEach((ch, i) => {
                const canvas = this._meterCanvases[i];
                if (canvas) this.drawMeter(canvas, this._peakLevels[i]);
            });
            // Master meter
            if (this._masterMeterCanvas) {
                this.drawMeter(this._masterMeterCanvas, this._peakLevels[8]);
            }
            this._animFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    stopMeterAnimation() {
        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }
    }

    // --- Public setters ---

    setChannelVolume(index, value) {
        if (index < 0 || index >= this.channels.length) return;
        this.channels[index].volume = value;
        if (this._faders[index]) {
            this._faders[index].value = Math.round(value * 100);
        }
    }

    setChannelPan(index, value) {
        if (index < 0 || index >= this.channels.length) return;
        this.channels[index].pan = value;
        if (this._panSliders[index]) {
            this._panSliders[index].value = Math.round(value * 100);
        }
    }

    setChannelMute(index, muted) {
        if (index < 0 || index >= this.channels.length) return;
        this.channels[index].muted = muted;
        const strip = this.container.querySelector(`.channel-strip[data-channel="${index}"]`);
        if (strip) {
            const btn = strip.querySelector('.mute-btn');
            if (btn) btn.classList.toggle('active', muted);
        }
    }

    setChannelSolo(index, solo) {
        if (index < 0 || index >= this.channels.length) return;
        this.channels[index].solo = solo;
        const strip = this.container.querySelector(`.channel-strip[data-channel="${index}"]`);
        if (strip) {
            const btn = strip.querySelector('.solo-btn');
            if (btn) btn.classList.toggle('active', solo);
        }
    }

    setMasterVolume(value) {
        this.master.volume = value;
        if (this._masterFader) {
            this._masterFader.value = Math.round(value * 100);
        }
    }

    setLevel(index, level) {
        if (index < 0 || index >= this.channels.length) return;
        // Peak hold: only rise instantly, falloff handled by animation
        if (level > this._peakLevels[index]) {
            this._peakLevels[index] = level;
        }
    }

    setMasterLevel(level) {
        if (level > this._peakLevels[8]) {
            this._peakLevels[8] = level;
        }
    }

    setChannelName(index, name) {
        if (index < 0 || index >= this.channels.length) return;
        this.channels[index].name = name;
        if (this._labels[index]) {
            this._labels[index].textContent = name;
        }
    }

    // --- Callback registration ---

    onVolumeChange(cb) {
        this._onVolumeChange = cb;
    }

    onPanChange(cb) {
        this._onPanChange = cb;
    }

    onMuteToggle(cb) {
        this._onMuteToggle = cb;
    }

    onSoloToggle(cb) {
        this._onSoloToggle = cb;
    }

    onSendChange(cb) {
        this._onSendChange = cb;
    }

    onMasterVolumeChange(cb) {
        this._onMasterVolumeChange = cb;
    }
}
