import {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Card, Checkbox, Descriptions, Input, InputNumber, List, Select, Space, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {formatMavrosFirmwareVersion, mavrosAutopilotName, type MavrosInfo} from '../../hooks/useMavrosInfo';
import {exportParamDocument, parseParamDocument, type ParamDocument} from '../../utils/fcuParamDocument';
import {identityFromMavros, identityFromParamComments, type ParamIdentity} from '../../utils/fcuParamIdentity';
import {admissibleParamCorrections, profileForIdentity, referenceParamHardware, reviewParamDocument,
    selectedParamCorrections, validParamHardware, type ParamHardware, type ParamReview} from '../../utils/fcuParamProfile';
import {listParamOriginals, saveParamOriginal, type ParamBackup} from '../../utils/fcuParamStorage';

const download = (filename: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], {type: 'text/plain;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
};
async function readParamFile(file: File): Promise<string> {
    if (file.size > 2_000_000 || !/\.param$/i.test(file.name)) throw new Error('invalidFile');
    const bytes = file.arrayBuffer ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('invalidFile')); reader.readAsArrayBuffer(file);
    });
    try {return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);} catch {throw new Error('invalidFile');}
}
export function FcuParamTool({info}: {info?: MavrosInfo}) {
    const {t} = useTranslation();
    const fileInput = useRef<HTMLInputElement>(null);
    const [document, setDocument] = useState<ParamDocument | null>(null);
    const [filename, setFilename] = useState('configuration.param');
    const [identity, setIdentity] = useState<ParamIdentity | null>(null);
    const detected = identityFromMavros(info);
    const target = identity ?? detected;
    const [hardware, setHardware] = useState<ParamHardware>(referenceParamHardware);
    const [backups, setBackups] = useState<ParamBackup[]>([]);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selection, setSelection] = useState<{key: string; ids: string[]}>({key: '', ids: []});
    const [confirmation, setConfirmation] = useState<{key: string; confirmed: boolean; reason: string}>({key: '', confirmed: false, reason: ''});
    const [category, setCategory] = useState('all');
    const profile = profileForIdentity(target);
    const planKey = JSON.stringify({filename, original: document?.original, target, hardware});
    const selected = selection.key === planKey ? selection.ids : [];
    const consent = confirmation.key === planKey ? confirmation : {confirmed: false, reason: ''};
    const rows = useMemo(() => document ? reviewParamDocument(document, target, hardware) : [], [document, target, hardware]);
    const sensitive = rows.filter(row => selected.includes(row.id) && (row.sensitive || row.provisional));
    const needsConsent = sensitive.length > 0;
    const failure = (caught: unknown) => {
        const key = caught instanceof Error ? caught.message : 'storageError';
        setError(t(`settingsFcuParams.errors.${['invalidFile', 'ambiguousParameter', 'backupCollision', 'confirmationRequired'].includes(key) ? key : 'storageError'}`));
    };
    useEffect(() => {
        let active = true;
        void listParamOriginals().then(stored => {if (active) setBackups(stored);})
            .catch(() => {if (active) setError(t('settingsFcuParams.errors.storageError'));})
            .finally(() => {if (active) setBusy(false);});
        return () => {active = false;};
    }, [t]);
    const load = (backup: ParamBackup) => {
        setDocument(parseParamDocument(backup.original)); setFilename(backup.filename); setIdentity({...backup.identity});
        setSelection({key: '', ids: []}); setConfirmation({key: '', confirmed: false, reason: ''}); setError(null);
    };
    const importFile = async (file: File) => {
        setBusy(true); setError(null);
        try {
            const original = await readParamFile(file); parseParamDocument(original);
            const fromFile = identityFromParamComments(original);
            // Live metadata describes the connected FCU, not necessarily the
            // uploaded export. Identification of that file remains explicit.
            const backup: ParamBackup = {id: `${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
                importedAt: new Date().toISOString(), filename: file.name, original, identity: fromFile};
            await saveParamOriginal(backup); load(backup); setBackups(previous => [backup, ...previous]);
        } catch (caught) {failure(caught);} finally {setBusy(false);}
    };
    const clearPlan = () => {setSelection({key: '', ids: []}); setConfirmation({key: '', confirmed: false, reason: ''});};
    const changeIdentity = (patch: Partial<ParamIdentity>) => {setIdentity({...target, ...patch, source: 'operator'}); clearPlan();};
    const changeHardware = (patch: Partial<ParamHardware>) => {setHardware(h => ({...h, ...patch})); clearPlan();};
    const selectRule = (row: ParamReview, checked: boolean) => setSelection({key: planKey,
        ids: checked ? [...selected.filter(id => id !== row.id), row.id] : selected.filter(id => id !== row.id)});
    const numberField = (key: keyof ParamHardware, min: number, max: number) => <Space key={key}>
        <Typography.Text>{t(`settingsFcuParams.bindings.${key}`)}</Typography.Text>
        <InputNumber aria-label={t(`settingsFcuParams.bindings.${key}`)} min={min} max={max} precision={0}
            value={hardware[key] as number} onChange={value => {if (value !== null) changeHardware({[key]: value});}}/>
    </Space>;
    return <Space direction="vertical" style={{width: '100%'}} size={16} data-testid="fcu-param-tool">
        <Alert type="info" showIcon message={t('settingsFcuParams.title')} description={t('settingsFcuParams.scope')}/>
        {error && <Alert type="error" message={error}/>}
        <Card size="small" title={t('settingsFcuParams.importTitle')}>
            <input ref={fileInput} type="file" accept=".param" hidden aria-label={t('settingsFcuParams.importButton')}
                onChange={e => {const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = '';}}/>
            <Button aria-label={t('settingsFcuParams.importButton')} loading={busy} disabled={busy} onClick={() => fileInput.current?.click()}>{t('settingsFcuParams.importButton')}</Button>
            <Typography.Paragraph>{t('settingsFcuParams.originalPolicy')}</Typography.Paragraph>
        </Card>
        <Card size="small" title={t('settingsFcuParams.identityTitle')}>
            <Descriptions size="small" column={3}>
                <Descriptions.Item label={t('settingsFcuParams.observedFirmware')}>{detected.source === 'mavros' ? mavrosAutopilotName(info?.vehicle?.autopilot) ?? '—' : '—'}</Descriptions.Item>
                <Descriptions.Item label={t('settingsFcuParams.version')}>{detected.source === 'mavros' ? formatMavrosFirmwareVersion(info?.vehicle ?? null) ?? '—' : '—'}</Descriptions.Item>
                <Descriptions.Item label={t('settingsFcuParams.board')}>{detected.board || '—'}</Descriptions.Item>
            </Descriptions>
            <Typography.Paragraph>{t('settingsFcuParams.identifyFile')}</Typography.Paragraph>
            <Space wrap>
                <Select aria-label={t('settingsFcuParams.family')} value={target.family} style={{width: 180}}
                    onChange={family => changeIdentity({family, vehicle: '', version: ''})}
                    options={['unknown', 'ardupilot', 'px4', 'other'].map(value => ({value, label: t(`settingsFcuParams.families.${value}`)}))}/>
                <Select aria-label={t('settingsFcuParams.vehicle')} value={target.vehicle} style={{width: 180}}
                    onChange={vehicle => changeIdentity({vehicle})} options={[{value: '', label: t('settingsFcuParams.unknown')}, {value: 'rover', label: 'Rover'}, {value: 'other', label: t('settingsFcuParams.otherVehicle')}]}/>
                <Input aria-label={t('settingsFcuParams.version')} placeholder={t('settingsFcuParams.version')} value={target.version} style={{width: 130}} onChange={e => changeIdentity({version: e.target.value.trim()})}/>
                <Input aria-label={t('settingsFcuParams.board')} placeholder={t('settingsFcuParams.board')} value={target.board} style={{width: 210}} onChange={e => changeIdentity({board: e.target.value})}/>
                <Button disabled={detected.family === 'unknown'} onClick={() => {changeIdentity(detected); const sysid = info?.vehicle?.sysid; if (sysid && sysid >= 1 && sysid <= 255) changeHardware({targetSysId: sysid});}}>{t('settingsFcuParams.useObserved')}</Button>
            </Space>
            <Typography.Paragraph type="secondary">{t('settingsFcuParams.identitySource', {source: t(`settingsFcuParams.sources.${target.source}`)})}</Typography.Paragraph>
            {!profile && <Alert type="warning" message={t('settingsFcuParams.unsupported')}/>}
        </Card>
        <Card size="small" title={t('settingsFcuParams.hardwareTitle')}>
            <Typography.Paragraph>{t('settingsFcuParams.bindingPolicy')}</Typography.Paragraph>
            <Space wrap>
                <Select aria-label={t('settingsFcuParams.drive')} value={hardware.drive} style={{width: 250}} onChange={drive => changeHardware({drive})}
                    options={['unknown', 'vesc-dronecan', 'pwm-skid'].map(value => ({value, label: t(`settingsFcuParams.drives.${value}`)}))}/>
                <Checkbox checked={hardware.blade} onChange={e => changeHardware({blade: e.target.checked})}>{t('settingsFcuParams.blade')}</Checkbox>
                {hardware.drive === 'vesc-dronecan' && <Checkbox checked={hardware.legacyRpm} onChange={e => changeHardware({legacyRpm: e.target.checked})}>{t('settingsFcuParams.legacyRpm')}</Checkbox>}
                <Typography.Text>{t('settingsFcuParams.serialPort')}</Typography.Text>
                <InputNumber aria-label={t('settingsFcuParams.serialPort')} min={0} max={9} precision={0} value={hardware.serialPort} onChange={serialPort => changeHardware({serialPort})}/>
                {numberField('mavlinkChannel', 1, 10)}{numberField('gcsSysId', 1, 255)}{numberField('targetSysId', 1, 255)}
                {hardware.drive !== 'unknown' && <>{numberField('rightOutput', 1, 16)}{numberField('leftOutput', 1, 16)}</>}
                {hardware.blade && numberField('bladeOutput', 1, 16)}
                {hardware.drive === 'vesc-dronecan' && <>{numberField('canPort', 1, 2)}{numberField('canDriver', 1, 2)}
                    {hardware.legacyRpm && <>{numberField('rightEscIndex', 0, 15)}{numberField('leftEscIndex', 0, 15)}</>}</>}
            </Space>
            {!validParamHardware(hardware) && <Alert type="error" message={t('settingsFcuParams.invalidBindings')}/>}
        </Card>
        {document && <Card size="small" title={`${filename} — ${document.entries.size} ${t('settingsFcuParams.parameters')}`}>
            <Alert type="warning" message={t('settingsFcuParams.provisionalPolicy')} style={{marginBottom: 12}}/>
            <Space wrap style={{marginBottom: 12}}>
                <Button disabled={!profile} onClick={() => setSelection({key: planKey, ids: [...new Set([...selected, ...admissibleParamCorrections(rows).map(row => row.id)])]})}>{t('settingsFcuParams.selectAdmissible')}</Button>
                <Button onClick={() => setSelection({key: planKey, ids: []})}>{t('settingsFcuParams.clearSelection')}</Button>
                <Select aria-label={t('settingsFcuParams.category')} value={category} style={{width: 240}} onChange={setCategory}
                    options={['all', 'required', 'conditional', 'recommended', 'optional', 'calibration'].map(value => ({value, label: t(`settingsFcuParams.categories.${value}`)}))}/>
            </Space>
            <Table<ParamReview> size="small" rowKey="id" dataSource={rows.filter(row => category === 'all' || category === row.category)} pagination={{pageSize: 12, showSizeChanger: true}} scroll={{x: 850}}
                columns={[
                    {title: t('settingsFcuParams.select'), render: (_, row) => <Checkbox aria-label={`${t('settingsFcuParams.select')} ${row.parameter}`} disabled={!row.editable} checked={selected.includes(row.id)} onChange={e => selectRule(row, e.target.checked)}/>},
                    {title: t('settingsFcuParams.parameter'), dataIndex: 'parameter'},
                    {title: t('settingsFcuParams.category'), render: (_, row) => <Tag>{t(`settingsFcuParams.categories.${row.category}`)}</Tag>},
                    {title: t('settingsFcuParams.current'), render: (_, row) => row.current ?? '—'},
                    {title: t('settingsFcuParams.proposed'), render: (_, row) => <>{row.accepted ? row.accepted.join(' / ') : row.proposed ?? '—'}{row.provisional && <Tag>{t('settingsFcuParams.provisional')}</Tag>}</>},
                    {title: t('settingsFcuParams.state'), render: (_, row) => <Tag color={row.state === 'compliant' ? 'success' : row.state === 'mismatch' || row.state === 'missing' || row.state === 'ambiguous' ? 'error' : 'default'}>{t(`settingsFcuParams.states.${row.state}`)}</Tag>},
                    {title: t('settingsFcuParams.reason'), render: (_, row) => <>{t(`settingsFcuParams.reasons.${row.reason}`)} <Typography.Text type="secondary">{t('settingsFcuParams.ruleScope', {versions: row.versions.join(', '), applicability: row.applicability})}</Typography.Text> <a href={row.contract} target="_blank" rel="noreferrer">{t('settingsFcuParams.contract')}</a>{row.source.startsWith('https://') && <> <a href={row.source} target="_blank" rel="noreferrer">{t('settingsFcuParams.documentation')}</a></>}</>},
                ]}/>
            {needsConsent && <Space direction="vertical" style={{width: '100%', marginTop: 12}}>
                <Alert type="warning" message={t('settingsFcuParams.confirmationTitle')} description={sensitive.map(row => row.parameter).join(', ')}/>
                <Checkbox checked={consent.confirmed} onChange={e => setConfirmation({key: planKey, ...consent, confirmed: e.target.checked})}>{t('settingsFcuParams.confirmation')}</Checkbox>
                <Input.TextArea aria-label={t('settingsFcuParams.justification')} placeholder={t('settingsFcuParams.justification')} value={consent.reason}
                    onChange={e => setConfirmation({key: planKey, ...consent, reason: e.target.value})}/>
            </Space>}
            <Space style={{marginTop: 12}}>
                <Button onClick={() => download(filename, document.original)}>{t('settingsFcuParams.downloadOriginal')}</Button>
                <Button type="primary" disabled={!profile || !validParamHardware(hardware) || !selected.length || (needsConsent && (!consent.confirmed || !consent.reason.trim()))}
                    onClick={() => {try {download(filename.replace(/\.param$/i, '-mowglinext.param'), exportParamDocument(document, selectedParamCorrections(rows, selected, consent)));} catch (caught) {failure(caught);}}}>{t('settingsFcuParams.export')}</Button>
            </Space>
        </Card>}
        <Card size="small" title={t('settingsFcuParams.backups')}>
            <List dataSource={backups} renderItem={backup => <List.Item actions={[
                <Button key="restore" disabled={busy} onClick={() => {try {load(backup);} catch (caught) {failure(caught);}}}>{t('settingsFcuParams.restore')}</Button>,
                <Button key="download" onClick={() => download(backup.filename, backup.original)}>{t('settingsFcuParams.downloadOriginal')}</Button>,
            ]}><List.Item.Meta title={backup.filename} description={backup.importedAt}/></List.Item>}/>
        </Card>
    </Space>;
}
