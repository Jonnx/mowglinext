import type {Status, WheelTick} from '../types/ros';

/** Display liveness only; never participates in motor control or safety. */
export const MOTOR_DISPLAY_STALE_MS = 5000;
const finite = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : NaN;
export const motorDisplayValue = (v: number, precision = 0): string => Number.isFinite(v) ? v.toFixed(precision) : '—';
const stampSeconds = (stamp: Status['stamp']): number =>
    stamp && Number.isFinite(stamp.sec) && Number.isFinite(stamp.nanosec)
        ? stamp.sec + stamp.nanosec * 1e-9 : NaN;

export function bladeTelemetry(status: Status, receivedAt: number | null, now: number, backend?: string) {
    // Compare observation and envelope only in their shared ROS clock. Receipt
    // liveness is independent, in the browser clock (including simulation).
    // MAVROS envelope freshness comes from other streams and may precede the
    // blade observation; that must not invalidate a newly acquired blade report.
    const blade = stampSeconds(status.blade_status_stamp);
    const envelope = stampSeconds(status.stamp);
    const age = envelope - blade;
    const fresh = receivedAt !== null && now - receivedAt >= 0 && now - receivedAt < MOTOR_DISPLAY_STALE_MS
        && blade > 0 && (!Number.isFinite(envelope) || envelope <= blade || age < MOTOR_DISPLAY_STALE_MS / 1000);
    return {
        fresh,
        rpm: fresh ? finite(status.mower_motor_rpm) : NaN,
        current: fresh ? finite(status.mower_esc_current) : NaN,
        escTemp: fresh ? finite(status.mower_esc_temperature) : NaN,
        // MAVROS reports ESC temperature, not winding temperature. Its default
        // scalar zero cannot prove a measurement of the motor winding.
        motorTemp: fresh && backend !== 'mavros' && backend !== undefined ? finite(status.mower_motor_temperature) : NaN,
    };
}

export const unknownWheelRpm = () => ({fl: NaN, fr: NaN, rl: NaN, rr: NaN, bodyOmega: NaN});

export function wheelRpmBetween(previous: WheelTick, current: WheelTick, radius: number) {
    const result = unknownWheelRpm();
    const factor = finite(current.wheel_tick_factor);
    const dt = stampSeconds(current.stamp) - stampSeconds(previous.stamp);
    if (!(factor > 0) || factor !== previous.wheel_tick_factor || !(radius > 0) || !Number.isFinite(radius)
        || !(dt > 0 && dt < MOTOR_DISPLAY_STALE_MS / 1000)) return result;
    const circumference = 2 * Math.PI * radius;
    for (const [wheel, mask] of [['fl', 1], ['fr', 2], ['rl', 4], ['rr', 8]] as const) {
        if (!((current.valid_wheels ?? 0) & (previous.valid_wheels ?? 0) & mask)) continue;
        const direction = current[`wheel_direction_${wheel}`];
        const counter = finite(current[`wheel_ticks_${wheel}`]);
        const old = finite(previous[`wheel_ticks_${wheel}`]);
        if ((direction !== 0 && direction !== 1) || !Number.isFinite(counter) || !Number.isFinite(old)) continue;
        let delta = counter - old;
        if (delta < -0x80000000) delta += 0x100000000; // uint32 rollover, not an ordinary reset
        if (delta < 0) continue;
        result[wheel] = delta * (direction === 1 ? 1 : -1) / factor / circumference * 60 / dt;
    }
    // Preserve the existing display estimate; no host-side motion control.
    result.bodyOmega = (result.rr - result.rl) * circumference / 60 / 0.32;
    return result;
}
