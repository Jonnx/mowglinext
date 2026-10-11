import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {FcuParamTool} from './FcuParamTool';
const storage = vi.hoisted(() => new Map<string, unknown>());
const storeState = vi.hoisted(() => ({fail: false}));
const urls = vi.hoisted(() => vi.fn((blob: Blob) => `blob:param-test-${blob.size}`));
vi.mock('localforage', () => ({default: {createInstance: vi.fn(() => ({
    keys: () => Promise.resolve([...storage.keys()]), getItem: (id: string) => Promise.resolve(storage.get(id) ?? null),
    setItem: (id: string, value: unknown) => {if (storeState.fail) return Promise.reject(new Error('quota')); storage.set(id, value); return Promise.resolve(value);},
}))}}));
const upload = (text: string, name = 'robot.param') => {
    const file = new File([text], name, {type: 'text/plain'});
    Object.defineProperty(file, 'arrayBuffer', {value: () => Promise.resolve(new TextEncoder().encode(text).buffer)});
    fireEvent.change(screen.getByLabelText('Import .param', {selector: 'input'}), {target: {files: [file]}});
};
const blobText = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(new TextDecoder('utf-8', {ignoreBOM: true}).decode(reader.result as ArrayBuffer));
    reader.onerror = reject; reader.readAsArrayBuffer(blob);
});
const supported = '# ArduRover 4.7.1\r\n# Board: Pixhawk 5X\r\nMAV_SYSID,1\r\nMAV_GCS_SYSID,42\r\nARMING_REQUIRE,0\r\nATC_SPEED_P,0.20000\r\nSERIAL0_PROTOCOL,0';
beforeEach(() => {
    storage.clear(); urls.mockClear(); storeState.fail = false;
    vi.stubGlobal('URL', {createObjectURL: urls, revokeObjectURL: vi.fn()});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
async function ready() {await waitFor(() => expect(screen.getByRole('button', {name: 'Import .param'})).not.toBeDisabled());}
describe('FCU .param tool', () => {
    it('does not expose a working copy or export when immutable backup storage fails', async () => {
        render(<FcuParamTool/>); await ready(); storeState.fail = true; upload(supported);
        expect(await screen.findByText(/Browser backup storage failed/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Export selected corrections'})).not.toBeInTheDocument();
        expect(storage.size).toBe(0);
    });
    it('backs up the exact original, exports selectively and restores without altering the backup', async () => {
        render(<FcuParamTool/>); await ready(); upload(supported);
        expect(await screen.findByText('robot.param')).toBeInTheDocument();
        expect([...storage.values()]).toHaveLength(1);
        expect((([...storage.values()][0]) as {original: string}).original).toBe(supported);
        fireEvent.change(screen.getByRole('spinbutton', {name: 'MAVROS logical SERIAL port (if identified)'}), {target: {value: '0'}});
        fireEvent.click(screen.getByRole('checkbox', {name: 'Select SERIAL0_PROTOCOL'}));
        fireEvent.click(screen.getByRole('button', {name: 'Export selected corrections'}));
        const blob = urls.mock.calls[urls.mock.calls.length - 1][0];
        expect(await blobText(blob)).toBe(supported.replace('SERIAL0_PROTOCOL,0', 'SERIAL0_PROTOCOL,2'));
        fireEvent.click(screen.getByRole('button', {name: 'Restore working copy'}));
        expect(screen.getByRole('checkbox', {name: 'Select SERIAL0_PROTOCOL'})).not.toBeChecked();
        expect((([...storage.values()][0]) as {original: string}).original).toBe(supported);
    });
    it('keeps uncertain safety policies read-only rather than proposing the reference value', async () => {
        render(<FcuParamTool/>); await ready(); upload(supported);
        await screen.findByText('robot.param');
        expect(screen.getByRole('checkbox', {name: 'Select ARMING_REQUIRE'})).toBeDisabled();
        expect(screen.queryByRole('checkbox', {name: 'I confirm these selected changes and their installed hardware implications.'})).not.toBeInTheDocument();
    });
    it('does not treat live FCU identity or default input values as permission to renumber SYSIDs', async () => {
        render(<FcuParamTool info={{state: {connected: true}, vehicle: {available_info: 3, autopilot: 3, type: 10, flight_sw_version: 0x040701ff, sysid: 23}}}/>);
        await ready(); upload(supported); await screen.findByText('robot.param');
        fireEvent.click(screen.getByRole('button', {name: 'Use observed identity for this file'}));
        fireEvent.click(screen.getByRole('button', {name: 'Select admissible corrections'}));
        expect(screen.getByRole('checkbox', {name: 'Select MAV_SYSID'})).toBeDisabled();
        expect(screen.getByRole('checkbox', {name: 'Select MAV_GCS_SYSID'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Export selected corrections'})).toBeDisabled();
    });
    it('does not infer imported firmware from parameter names or apply PX4 rules as ArduPilot', async () => {
        render(<FcuParamTool info={{state: {connected: true}, vehicle: {available_info: 3, autopilot: 12, type: 10, flight_sw_version: 0x040701ff}}}/>);
        await ready(); upload('MAV_SYSID,1\nMAV_GCS_SYSID,42\n');
        await screen.findByText('robot.param');
        expect(screen.getByRole('button', {name: 'Export selected corrections'})).toBeDisabled();
        expect(screen.queryByRole('checkbox', {name: 'Select MAV_GCS_SYSID'})).not.toBeInTheDocument();
        expect(screen.getByText(/No comparison profile/)).toBeInTheDocument();
    });
    it('bulk selection excludes safety and provisional rules, and changing bindings invalidates old selections', async () => {
        render(<FcuParamTool/>); await ready(); upload(supported); await screen.findByText('robot.param');
        fireEvent.change(screen.getByRole('spinbutton', {name: 'MAVROS logical SERIAL port (if identified)'}), {target: {value: '0'}});
        fireEvent.click(screen.getByRole('button', {name: 'Select admissible corrections'}));
        expect(screen.getByRole('checkbox', {name: 'Select SERIAL0_PROTOCOL'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Select MAV_SYSID'})).toBeDisabled();
        expect(screen.getByRole('checkbox', {name: 'Select MAV_GCS_SYSID'})).toBeDisabled();
        expect(screen.getByRole('checkbox', {name: 'Select ARMING_REQUIRE'})).not.toBeChecked();
        fireEvent.change(screen.getByRole('spinbutton', {name: 'MAVROS source system ID to verify'}), {target: {value: '99'}});
        expect(screen.getByRole('checkbox', {name: 'Select SERIAL0_PROTOCOL'})).not.toBeChecked();
        expect(screen.getByRole('button', {name: 'Export selected corrections'})).toBeDisabled();
        fireEvent.change(screen.getByRole('spinbutton', {name: 'MAVROS source system ID to verify'}), {target: {value: '255'}});
        expect(screen.getByRole('checkbox', {name: 'Select SERIAL0_PROTOCOL'})).not.toBeChecked();
    });
});
