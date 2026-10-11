import {describe, expect, it} from 'vitest';
import type {Status, WheelTick} from '../types/ros';
import {bladeTelemetry, motorDisplayValue, wheelRpmBetween} from './motorTelemetry';

const status: Status = {stamp: {sec: 100, nanosec: 0}, blade_status_stamp: {sec: 99, nanosec: 0},
    mower_motor_rpm: 3200, mower_esc_current: 1.25, mower_esc_temperature: 42,
    mower_motor_temperature: 36};
const ticks = (sec: number, count: number, factor = 1000): WheelTick => ({stamp: {sec, nanosec: 0},
    wheel_tick_factor: factor, valid_wheels: 12, wheel_ticks_rl: count, wheel_ticks_rr: count,
    wheel_direction_rl: 1, wheel_direction_rr: 0});

describe('existing motor telemetry contract', () => {
    it('projects native Status unchanged in RPM, A and degrees Celsius', () => {
        expect(bladeTelemetry(status, 1000, 1001, 'mowgli')).toEqual({fresh: true, rpm: 3200,
            current: 1.25, escTemp: 42, motorTemp: 36});
    });
    it('uses the same blade values for MAVROS and keeps unavailable winding temperature unknown', () => {
        const result = bladeTelemetry(status, 1000, 1001, 'mavros');
        expect(result).toMatchObject({rpm: 3200, current: 1.25, escTemp: 42});
        expect(result.motorTemp).toBeNaN();
    });
    it('preserves actual zero readings and does not infer zero from absent/null/nonfinite fields', () => {
        expect(bladeTelemetry({...status, mower_motor_rpm: 0, mower_esc_current: 0}, 1000, 1001, 'mavros'))
            .toMatchObject({rpm: 0, current: 0});
        const result = bladeTelemetry({...status, mower_esc_current: undefined, mower_esc_temperature: NaN}, 1000, 1001, 'mavros');
        expect(result.current).toBeNaN(); expect(result.escTemp).toBeNaN();
        expect(motorDisplayValue(result.current)).toBe('—');
    });
    it.each([
        {...status, blade_status_stamp: {sec: 0, nanosec: 0}},
        {...status, stamp: {sec: 106, nanosec: 0}},
    ])('requires a current direct blade report in the shared ROS clock', sample => {
        expect(bladeTelemetry(sample, 1000, 1001, 'mowgli').rpm).toBeNaN();
    });
    it('accepts a blade report newer than the independent MAVROS envelope', () => {
        expect(bladeTelemetry({...status, stamp: {sec: 98, nanosec: 0}}, 1000, 1001, 'mavros').rpm).toBe(3200);
    });
    it('independently rejects missing/expired receipt liveness, without comparing ROS time to wall time', () => {
        expect(bladeTelemetry(status, null, Date.now(), 'mowgli').rpm).toBeNaN();
        expect(bladeTelemetry(status, 1000, 6000, 'mowgli').rpm).toBeNaN();
        expect(bladeTelemetry(status, 1000, 1001, 'mowgli').rpm).toBe(3200);
    });
    it('derives the same calibrated wheel RPM from native and scaled MAVROS ticks, not raw motor RPM', () => {
        const radius = 1 / (2 * Math.PI);
        const native = wheelRpmBetween(ticks(1, 0), ticks(2, 100), radius);
        const mavros = wheelRpmBetween(ticks(1, 0, 1000000), ticks(2, 100000, 1000000), radius);
        expect(native).toEqual(mavros);
        expect(native.rl).toBe(6); expect(native.rr).toBe(-6);
        expect(native.fl).toBeNaN(); expect(native.fr).toBeNaN();
    });
    it('preserves valid stopped wheels and respects per-wheel invalidation', () => {
        const previous = ticks(1, 100); const current = ticks(2, 100);
        expect(wheelRpmBetween(previous, current, 0.04).rl).toBe(0);
        expect(wheelRpmBetween(previous, {...current, valid_wheels: 8}, 0.04).rl).toBeNaN();
    });
    it('invalidates calibration changes, uncalibrated data, resets and invalid timing', () => {
        for (const current of [ticks(2, 100, 0), ticks(2, 100, 2000), ticks(1, 100), ticks(0, 100), ticks(10, 100), ticks(2, 0)]) {
            expect(wheelRpmBetween(ticks(1, 10), current, 0.04).rl).toBeNaN();
        }
    });
    it('handles uint32 rollover without interpreting an ordinary counter reset as motion', () => {
        expect(wheelRpmBetween(ticks(1, 0xffffffff), ticks(2, 1), 1/(2*Math.PI)).rl).toBeCloseTo(0.12);
    });
});
