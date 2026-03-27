// ═══════════════════════════════════════════════════════════════
// NOVA — Real-Time Collaboration Engine
// Tab-to-tab jam sessions via BroadcastChannel API
// ═══════════════════════════════════════════════════════════════

const MAX_PEERS = 4;
const HEARTBEAT_INTERVAL = 2000;
const PEER_TIMEOUT = 6000;
const MAX_CHAT_MESSAGES = 20;
const CHANNEL_NAME = 'nova-collab';

export default class CollabManager {
    constructor() {
        this.peerId = crypto.randomUUID();
        this.channel = null;
        this.role = null;
        this.name = null;
        this.connected = false;
        this.peers = new Map();
        this.chatLog = [];

        this._heartbeatTimer = null;
        this._cleanupTimer = null;

        // Callback registries
        this._callbacks = {
            peerJoin: [],
            peerLeave: [],
            transport: [],
            drumPattern: [],
            notes: [],
            synthParam: [],
            effectParam: [],
            chat: []
        };
    }

    // ── Connection ──────────────────────────────────────────────

    joinSession(name, role = 'jammer') {
        if (this.connected) return;

        this.name = name;
        this.role = role;
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (e) => this._handleMessage(e.data);
        this.connected = true;

        this._broadcast('announce', { name: this.name, role: this.role });

        this._heartbeatTimer = setInterval(() => {
            this._broadcast('heartbeat', { peerId: this.peerId });
        }, HEARTBEAT_INTERVAL);

        this._cleanupTimer = setInterval(() => this._pruneStale(), HEARTBEAT_INTERVAL);
    }

    leaveSession() {
        if (!this.connected) return;

        this._broadcast('leave', {});
        clearInterval(this._heartbeatTimer);
        clearInterval(this._cleanupTimer);
        this.channel.close();

        this.channel = null;
        this.connected = false;
        this.peers.clear();
        this.role = null;
        this.name = null;
        this._updateUI();
    }

    isConnected() {
        return this.connected;
    }

    getRole() {
        return this.role;
    }

    getPeers() {
        return Array.from(this.peers.values()).map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            lastSeen: p.lastSeen
        }));
    }

    // ── Sending ─────────────────────────────────────────────────

    sendTransport(action, bpm, swing) {
        if (this.role !== 'host') return;
        this._broadcast('transport', { action, bpm, swing });
    }

    sendDrumPattern(pattern) {
        this._broadcast('drumPattern', { pattern });
    }

    sendNotes(notes) {
        this._broadcast('notes', { notes });
    }

    sendSynthParam(param, value) {
        this._broadcast('synthParam', { param, value });
    }

    sendEffectParam(effect, param, value) {
        this._broadcast('effectParam', { effect, param, value });
    }

    sendChat(message) {
        this._broadcast('chat', { message });
        this._appendChat(this.peerId, this.name, message);
    }

    // ── Receiving (callback registration) ───────────────────────

    onPeerJoin(cb)    { this._callbacks.peerJoin.push(cb); }
    onPeerLeave(cb)   { this._callbacks.peerLeave.push(cb); }
    onTransport(cb)   { this._callbacks.transport.push(cb); }
    onDrumPattern(cb) { this._callbacks.drumPattern.push(cb); }
    onNotes(cb)       { this._callbacks.notes.push(cb); }
    onSynthParam(cb)  { this._callbacks.synthParam.push(cb); }
    onEffectParam(cb) { this._callbacks.effectParam.push(cb); }
    onChat(cb)        { this._callbacks.chat.push(cb); }

    // ── Internal: messaging ─────────────────────────────────────

    _broadcast(type, data) {
        if (!this.channel) return;
        this.channel.postMessage({
            type,
            peerId: this.peerId,
            timestamp: Date.now(),
            data
        });
    }

    _emit(event, ...args) {
        for (const cb of this._callbacks[event]) {
            try { cb(...args); } catch (_) { /* swallow */ }
        }
    }

    _handleMessage(msg) {
        if (!msg || msg.peerId === this.peerId) return;

        const { type, peerId, timestamp, data } = msg;

        switch (type) {
            case 'announce': {
                if (this.peers.size >= MAX_PEERS) return;
                const peer = { id: peerId, name: data.name, role: data.role, lastSeen: timestamp };
                this.peers.set(peerId, peer);
                this._emit('peerJoin', { ...peer });
                // Reply so the new peer knows about us
                this._broadcast('announce', { name: this.name, role: this.role });
                break;
            }
            case 'heartbeat': {
                const existing = this.peers.get(peerId);
                if (existing) existing.lastSeen = timestamp;
                break;
            }
            case 'leave': {
                this.peers.delete(peerId);
                this._emit('peerLeave', peerId);
                break;
            }
            case 'transport': {
                // Host always wins — ignore transport from non-hosts if we are host
                this._emit('transport', { action: data.action, bpm: data.bpm, swing: data.swing });
                break;
            }
            case 'drumPattern': {
                this._emit('drumPattern', data.pattern);
                break;
            }
            case 'notes': {
                this._emit('notes', data.notes);
                break;
            }
            case 'synthParam': {
                this._emit('synthParam', data.param, data.value);
                break;
            }
            case 'effectParam': {
                this._emit('effectParam', data.effect, data.param, data.value);
                break;
            }
            case 'chat': {
                const senderPeer = this.peers.get(peerId);
                const senderName = senderPeer ? senderPeer.name : peerId.slice(0, 6);
                this._appendChat(peerId, senderName, data.message);
                this._emit('chat', peerId, data.message);
                break;
            }
        }

        this._updateUI();
    }

    // ── Peer management ─────────────────────────────────────────

    _pruneStale() {
        const now = Date.now();
        for (const [id, peer] of this.peers) {
            if (now - peer.lastSeen > PEER_TIMEOUT) {
                this.peers.delete(id);
                this._emit('peerLeave', id);
            }
        }
        this._updateUI();
    }

    // ── Chat log ────────────────────────────────────────────────

    _appendChat(peerId, name, message) {
        this.chatLog.push({ peerId, name, message, time: Date.now() });
        if (this.chatLog.length > MAX_CHAT_MESSAGES) {
            this.chatLog.shift();
        }
        this._renderChat();
    }

    // ── UI Component ────────────────────────────────────────────

    buildUI(container) {
        this._container = container;
        this._injectStyles();

        const panel = document.createElement('div');
        panel.className = 'collab-panel';
        panel.innerHTML = `
            <div class="collab-header" data-ref="header">
                <span class="collab-indicator" data-ref="indicator"></span>
                <span class="collab-title">Collab</span>
                <button class="collab-toggle" data-ref="toggle">&#x25BC;</button>
            </div>
            <div class="collab-body" data-ref="body">
                <div class="collab-status" data-ref="status">Not connected</div>
                <div class="collab-peers" data-ref="peers"></div>
                <div class="collab-chat-messages" data-ref="messages"></div>
                <div class="collab-chat-input-row">
                    <input type="text" class="collab-chat-input" data-ref="chatInput"
                           placeholder="Send a message..." maxlength="200" />
                    <button class="collab-send-btn" data-ref="sendBtn">Send</button>
                </div>
                <button class="collab-leave-btn" data-ref="leaveBtn">Leave Session</button>
            </div>
        `;

        container.appendChild(panel);

        // Cache refs
        this._ui = {};
        panel.querySelectorAll('[data-ref]').forEach(el => {
            this._ui[el.dataset.ref] = el;
        });

        // Toggle collapse
        let collapsed = false;
        this._ui.toggle.addEventListener('click', () => {
            collapsed = !collapsed;
            this._ui.body.style.display = collapsed ? 'none' : '';
            this._ui.toggle.textContent = collapsed ? '\u25B6' : '\u25BC';
        });

        // Chat send
        const doSend = () => {
            const val = this._ui.chatInput.value.trim();
            if (!val || !this.connected) return;
            this.sendChat(val);
            this._ui.chatInput.value = '';
        };
        this._ui.sendBtn.addEventListener('click', doSend);
        this._ui.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSend();
        });

        // Leave
        this._ui.leaveBtn.addEventListener('click', () => this.leaveSession());

        this._updateUI();
    }

    _updateUI() {
        if (!this._ui) return;

        // Status & indicator
        if (this.connected) {
            const roleLabel = this.role === 'host' ? 'Host' : 'Jammer';
            this._ui.status.textContent = `Connected as ${roleLabel}`;
            this._ui.indicator.classList.add('active');
            this._ui.leaveBtn.style.display = '';
        } else {
            this._ui.status.textContent = 'Not connected';
            this._ui.indicator.classList.remove('active');
            this._ui.leaveBtn.style.display = 'none';
        }

        // Peer list
        const peersEl = this._ui.peers;
        peersEl.innerHTML = '';
        for (const peer of this.peers.values()) {
            const row = document.createElement('div');
            row.className = 'collab-peer-row';
            const badge = peer.role === 'host' ? 'HOST' : 'JAM';
            const badgeClass = peer.role === 'host' ? 'badge-host' : 'badge-jammer';
            row.innerHTML = `<span class="collab-badge ${badgeClass}">${badge}</span> ${this._esc(peer.name)}`;
            peersEl.appendChild(row);
        }

        this._renderChat();
    }

    _renderChat() {
        if (!this._ui) return;
        const el = this._ui.messages;
        el.innerHTML = '';
        for (const entry of this.chatLog) {
            const line = document.createElement('div');
            line.className = 'collab-chat-line';
            const isSelf = entry.peerId === this.peerId;
            line.innerHTML = `<strong class="${isSelf ? 'chat-self' : ''}">${this._esc(entry.name)}:</strong> ${this._esc(entry.message)}`;
            el.appendChild(line);
        }
        el.scrollTop = el.scrollHeight;
    }

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    _injectStyles() {
        if (document.getElementById('collab-styles')) return;
        const style = document.createElement('style');
        style.id = 'collab-styles';
        style.textContent = `
            .collab-panel {
                position: fixed;
                bottom: 16px;
                right: 16px;
                width: 280px;
                background: var(--nova-surface, #12121a);
                border: 1px solid var(--nova-border, #2a2a3a);
                border-radius: var(--radius-lg, 10px);
                font-family: var(--font-sans, 'Inter', sans-serif);
                color: var(--nova-text, #e0e0e8);
                z-index: 9999;
                box-shadow: 0 4px 24px rgba(0,0,0,0.5);
                overflow: hidden;
            }
            .collab-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: var(--nova-surface-2, #1a1a25);
                border-bottom: 1px solid var(--nova-border, #2a2a3a);
                cursor: default;
                user-select: none;
            }
            .collab-indicator {
                width: 8px; height: 8px;
                border-radius: 50%;
                background: var(--nova-text-muted, #444455);
                transition: background var(--transition-fast, 100ms ease);
            }
            .collab-indicator.active {
                background: var(--nova-success, #00ff88);
                box-shadow: 0 0 6px rgba(0,255,136,0.5);
            }
            .collab-title {
                flex: 1;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: var(--nova-text-dim, #6a6a7a);
            }
            .collab-toggle {
                background: none; border: none; color: var(--nova-text-dim, #6a6a7a);
                cursor: pointer; font-size: 10px; padding: 2px 4px;
            }
            .collab-body {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 10px 12px;
                max-height: 360px;
            }
            .collab-status {
                font-size: 11px;
                color: var(--nova-accent, #00d4ff);
                font-weight: 500;
            }
            .collab-peers {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .collab-peer-row {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                padding: 3px 0;
            }
            .collab-badge {
                font-size: 9px;
                font-weight: 700;
                padding: 1px 5px;
                border-radius: var(--radius-sm, 3px);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .badge-host {
                background: var(--nova-accent-2, #7b2fff);
                color: #fff;
            }
            .badge-jammer {
                background: var(--nova-accent, #00d4ff);
                color: #000;
            }
            .collab-chat-messages {
                flex: 1;
                min-height: 60px;
                max-height: 140px;
                overflow-y: auto;
                font-size: 11px;
                background: var(--nova-bg, #0a0a0f);
                border-radius: var(--radius-sm, 3px);
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .collab-chat-line {
                line-height: 1.4;
                word-break: break-word;
            }
            .chat-self {
                color: var(--nova-accent, #00d4ff);
            }
            .collab-chat-input-row {
                display: flex;
                gap: 4px;
            }
            .collab-chat-input {
                flex: 1;
                background: var(--nova-surface-3, #222233);
                border: 1px solid var(--nova-border, #2a2a3a);
                border-radius: var(--radius-sm, 3px);
                color: var(--nova-text, #e0e0e8);
                font-family: inherit;
                font-size: 11px;
                padding: 5px 8px;
                outline: none;
            }
            .collab-chat-input:focus {
                border-color: var(--nova-accent, #00d4ff);
            }
            .collab-send-btn, .collab-leave-btn {
                background: var(--nova-surface-3, #222233);
                border: 1px solid var(--nova-border, #2a2a3a);
                border-radius: var(--radius-sm, 3px);
                color: var(--nova-text-dim, #6a6a7a);
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                padding: 4px 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                transition: background var(--transition-fast, 100ms ease),
                            color var(--transition-fast, 100ms ease);
            }
            .collab-send-btn:hover, .collab-leave-btn:hover {
                background: var(--nova-border, #2a2a3a);
                color: var(--nova-text, #e0e0e8);
            }
            .collab-leave-btn {
                width: 100%;
                border-color: var(--nova-danger, #ff3366);
                color: var(--nova-danger, #ff3366);
            }
            .collab-leave-btn:hover {
                background: rgba(255,51,102,0.15);
                color: #ff5577;
            }
        `;
        document.head.appendChild(style);
    }
}
