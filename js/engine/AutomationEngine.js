/**
 * NOVA DAW — AutomationEngine
 *
 * Records, stores, and plays back parameter automation curves
 * in sync with the transport clock. Supports multiple lanes per
 * target parameter, linear/smooth interpolation, draw/erase editing,
 * and real-time recording from knob movements.
 *
 * Each automation lane holds a sorted array of breakpoints:
 *   { time: <beats>, value: <0-1 normalized> }
 *
 * During playback, the engine interpolates between breakpoints and
 * dispatches value changes via callbacks at each scheduler tick.
 */

const RECORD_THROTTLE_MS = 30; // minimum ms between recorded points
const SMOOTH_WINDOW = 3;       // breakpoints to average for smoothing

export default class AutomationEngine {
    constructor() {
        /**
         * Map of paramPath → AutomationLaneData
         * Each lane: { points: [], enabled: true, range: { min, max }, label }
         */
        this.lanes = new Map();

        /** Currently armed lanes for recording (Set of paramPaths) */
        this.armedLanes = new Set();

        /** Whether we're actively recording */
        this.isRecording = false;

        /** Callback: (paramPath, value) => void — fired during playback */
        this._onValue = null;

        /** Last record timestamp per lane to throttle input */
        this._lastRecordTime = new Map();

        /** Snapshot of values at last playback position for change detection */
        this._lastValues = new Map();
    }

    // ─── Lane Management ────────────────────────────────────────────

    /**
     * Create or get an automation lane for a parameter.
     * @param {string} paramPath - dot-path like 'filter.frequency' or 'channel.0.volume'
     * @param {object} opts - { min, max, label, defaultValue }
     * @returns {object} The lane data
     */
    createLane(paramPath, opts = {}) {
        if (this.lanes.has(paramPath)) return this.lanes.get(paramPath);

        const lane = {
            paramPath,
            points: [],
            enabled: true,
            range: {
                min: opts.min ?? 0,
                max: opts.max ?? 1
            },
            label: opts.label || paramPath,
            defaultValue: opts.defaultValue ?? 0.5,
            interpolation: 'linear' // 'linear' | 'smooth' | 'step'
        };

        this.lanes.set(paramPath, lane);
        return lane;
    }

    /**
     * Remove an automation lane entirely.
     */
    removeLane(paramPath) {
        this.lanes.delete(paramPath);
        this.armedLanes.delete(paramPath);
        this._lastValues.delete(paramPath);
    }

    /**
     * Get a lane's data.
     */
    getLane(paramPath) {
        return this.lanes.get(paramPath) || null;
    }

    /**
     * Get all lane paths.
     */
    getLanePaths() {
        return [...this.lanes.keys()];
    }

    /**
     * Enable/disable a lane (disabled lanes don't emit values during playback).
     */
    setLaneEnabled(paramPath, enabled) {
        const lane = this.lanes.get(paramPath);
        if (lane) lane.enabled = enabled;
    }

    /**
     * Set interpolation mode for a lane.
     */
    setInterpolation(paramPath, mode) {
        const lane = this.lanes.get(paramPath);
        if (lane) lane.interpolation = mode;
    }

    // ─── Breakpoint Editing ─────────────────────────────────────────

    /**
     * Add a breakpoint to a lane. Maintains sorted order by time.
     * @param {string} paramPath
     * @param {number} time - in beats
     * @param {number} value - normalized 0-1
     */
    addPoint(paramPath, time, value) {
        const lane = this.lanes.get(paramPath);
        if (!lane) return;

        value = Math.max(0, Math.min(1, value));
        const point = { time, value };

        // Binary search insert to maintain sorted order
        const idx = this._findInsertIndex(lane.points, time);

        // If a point exists at this exact time (within epsilon), replace it
        if (idx < lane.points.length && Math.abs(lane.points[idx].time - time) < 0.001) {
            lane.points[idx].value = value;
        } else {
            lane.points.splice(idx, 0, point);
        }
    }

    /**
     * Remove all points in a time range.
     */
    eraseRange(paramPath, startTime, endTime) {
        const lane = this.lanes.get(paramPath);
        if (!lane) return;

        lane.points = lane.points.filter(
            p => p.time < startTime || p.time > endTime
        );
    }

    /**
     * Clear all points from a lane.
     */
    clearLane(paramPath) {
        const lane = this.lanes.get(paramPath);
        if (lane) lane.points = [];
    }

    /**
     * Set all points for a lane at once (for undo/redo or bulk editing).
     */
    setPoints(paramPath, points) {
        const lane = this.lanes.get(paramPath);
        if (!lane) return;

        lane.points = points
            .map(p => ({ time: p.time, value: Math.max(0, Math.min(1, p.value)) }))
            .sort((a, b) => a.time - b.time);
    }

    /**
     * Get all points for a lane (returns a copy).
     */
    getPoints(paramPath) {
        const lane = this.lanes.get(paramPath);
        if (!lane) return [];
        return lane.points.map(p => ({ ...p }));
    }

    /**
     * Apply smoothing to a lane's points by averaging neighbors.
     */
    smoothLane(paramPath) {
        const lane = this.lanes.get(paramPath);
        if (!lane || lane.points.length < 3) return;

        const smoothed = lane.points.map((p, i) => {
            const start = Math.max(0, i - SMOOTH_WINDOW);
            const end = Math.min(lane.points.length - 1, i + SMOOTH_WINDOW);
            let sum = 0;
            let count = 0;
            for (let j = start; j <= end; j++) {
                sum += lane.points[j].value;
                count++;
            }
            return { time: p.time, value: sum / count };
        });

        // Preserve first and last point values
        smoothed[0].value = lane.points[0].value;
        smoothed[smoothed.length - 1].value = lane.points[lane.points.length - 1].value;

        lane.points = smoothed;
    }

    // ─── Recording ──────────────────────────────────────────────────

    /**
     * Arm a lane for recording. When playback is active and recording is
     * enabled, parameter changes will be captured as breakpoints.
     */
    armLane(paramPath) {
        this.armedLanes.add(paramPath);
    }

    /**
     * Disarm a lane.
     */
    disarmLane(paramPath) {
        this.armedLanes.delete(paramPath);
    }

    /**
     * Start recording (call when transport starts playing in record mode).
     */
    startRecording() {
        this.isRecording = true;
        this._lastRecordTime.clear();
    }

    /**
     * Stop recording.
     */
    stopRecording() {
        this.isRecording = false;
    }

    /**
     * Record a value for an armed lane at the current transport position.
     * Called by the UI when a knob is moved during recording.
     * @param {string} paramPath
     * @param {number} beatPosition - current transport position in beats
     * @param {number} normalizedValue - 0-1
     */
    recordValue(paramPath, beatPosition, normalizedValue) {
        if (!this.isRecording || !this.armedLanes.has(paramPath)) return;

        // Throttle recording to avoid excessive points
        const now = performance.now();
        const lastTime = this._lastRecordTime.get(paramPath) || 0;
        if (now - lastTime < RECORD_THROTTLE_MS) return;
        this._lastRecordTime.set(paramPath, now);

        this.addPoint(paramPath, beatPosition, normalizedValue);
    }

    // ─── Playback ───────────────────────────────────────────────────

    /**
     * Register the value change callback.
     * @param {Function} fn - (paramPath, denormalizedValue, normalizedValue) => void
     */
    onValue(fn) {
        this._onValue = fn;
    }

    /**
     * Called by the transport on each step/tick to evaluate automation.
     * @param {number} beatPosition - current position in beats
     */
    evaluate(beatPosition) {
        if (!this._onValue) return;

        for (const [paramPath, lane] of this.lanes) {
            if (!lane.enabled || lane.points.length === 0) continue;

            // Don't write to lanes that are being recorded
            if (this.isRecording && this.armedLanes.has(paramPath)) continue;

            const normalized = this._interpolate(lane, beatPosition);
            const lastVal = this._lastValues.get(paramPath);

            // Only fire callback if value changed (avoid redundant updates)
            if (lastVal === undefined || Math.abs(normalized - lastVal) > 0.001) {
                this._lastValues.set(paramPath, normalized);
                const denormalized = lane.range.min + normalized * (lane.range.max - lane.range.min);
                this._onValue(paramPath, denormalized, normalized);
            }
        }
    }

    /**
     * Reset playback state (call when transport stops).
     */
    resetPlayback() {
        this._lastValues.clear();
    }

    // ─── Interpolation ──────────────────────────────────────────────

    /**
     * Interpolate the value at a given beat position from a lane's breakpoints.
     * @private
     */
    _interpolate(lane, beatPosition) {
        const pts = lane.points;
        if (pts.length === 0) return lane.defaultValue;
        if (pts.length === 1) return pts[0].value;

        // Before first point
        if (beatPosition <= pts[0].time) return pts[0].value;

        // After last point
        if (beatPosition >= pts[pts.length - 1].time) return pts[pts.length - 1].value;

        // Find surrounding points via binary search
        let lo = 0;
        let hi = pts.length - 1;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (pts[mid].time <= beatPosition) {
                lo = mid;
            } else {
                hi = mid;
            }
        }

        const p0 = pts[lo];
        const p1 = pts[hi];
        const t = (beatPosition - p0.time) / (p1.time - p0.time);

        switch (lane.interpolation) {
            case 'step':
                return p0.value;

            case 'smooth': {
                // Cubic Hermite (Catmull-Rom) for smoother curves
                const t2 = t * t;
                const t3 = t2 * t;
                // Smoothstep
                const s = t3 * (6 * t2 - 15 * t + 10);
                return p0.value + (p1.value - p0.value) * s;
            }

            case 'linear':
            default:
                return p0.value + (p1.value - p0.value) * t;
        }
    }

    // ─── Utility ────────────────────────────────────────────────────

    /**
     * Binary search for insert position.
     * @private
     */
    _findInsertIndex(points, time) {
        let lo = 0;
        let hi = points.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (points[mid].time < time) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    // ─── Serialization ──────────────────────────────────────────────

    /**
     * Export all lane data for project save.
     */
    serialize() {
        const data = {};
        for (const [path, lane] of this.lanes) {
            data[path] = {
                points: lane.points.map(p => ({ time: p.time, value: p.value })),
                enabled: lane.enabled,
                range: { ...lane.range },
                label: lane.label,
                defaultValue: lane.defaultValue,
                interpolation: lane.interpolation
            };
        }
        return data;
    }

    /**
     * Restore lane data from a project save.
     */
    deserialize(data) {
        this.lanes.clear();
        this.armedLanes.clear();
        this._lastValues.clear();

        for (const [path, laneData] of Object.entries(data)) {
            this.createLane(path, {
                min: laneData.range?.min ?? 0,
                max: laneData.range?.max ?? 1,
                label: laneData.label || path,
                defaultValue: laneData.defaultValue ?? 0.5
            });
            const lane = this.lanes.get(path);
            lane.points = (laneData.points || []).map(p => ({ time: p.time, value: p.value }));
            lane.enabled = laneData.enabled !== false;
            lane.interpolation = laneData.interpolation || 'linear';
        }
    }

    /**
     * Get the total time span of all automation data (in beats).
     */
    getTotalLength() {
        let max = 0;
        for (const lane of this.lanes.values()) {
            if (lane.points.length > 0) {
                const last = lane.points[lane.points.length - 1].time;
                if (last > max) max = last;
            }
        }
        return max;
    }
}
