import type {MeasurementEditorState} from "./useMeasurementEditor";
import {Button} from "antd";
import {MeasurementDialog, MeasurementLegend} from "./MeasurementEditor";
import {measurementGeometry, MEASUREMENTS} from "./measurements";
import {resolveCasterPosition} from "../../utils/casterPosition";
import {DOCK_VISUAL_DEFAULTS} from "./dockGeometry";
import {resolveDockAppearance} from "../../constants/mowerAppearances";
import {dockVisualGeometry} from "./dockGeometry";
import {Card, Flex, Select, Switch, Typography} from "antd";
import {useTranslation} from "react-i18next";
import {useRobotDescription} from "../../hooks/useRobotDescription";
import {MOWER_STYLES, useMowerVisual} from "../../hooks/useMowerVisual";
import {previewRobotGeometry} from "../../utils/robotModel";
import {MowerView} from "./MowerView";
export {MowerView} from "./MowerView";

export function MowerVisualControls({chooseStyle = false, transparent, onTransparencyChange}: {
    chooseStyle?: boolean; transparent?: boolean; onTransparencyChange?: (value: boolean) => void;
}) {
    const {t} = useTranslation();
    const [preference, setPreference] = useMowerVisual();
    return <Flex wrap gap={12} align="center" style={{marginBottom:12}}>
        {chooseStyle && <Select aria-label={t("mowerVisual.bodyStyle")} value={preference.style} style={{minWidth:150}}
            options={MOWER_STYLES.map(style => ({value:style,label:t("mowerVisual."+style)}))}
            onChange={style=>setPreference({style})}/>}
        <label style={{display:"inline-flex",gap:8,alignItems:"center"}}>
            <Switch size="small" checked={transparent ?? preference.transparent} onChange={value=>onTransparencyChange ? onTransparencyChange(value) : setPreference({transparent: value})}/>
            {t("mowerVisual.transparent")}
        </label>
        {!onTransparencyChange && <Typography.Text type="secondary" style={{fontSize:11}}>{t("mowerVisual.browserPreference")}</Typography.Text>}
    </Flex>;
}
export function MowerPreview({values, compact = false, editor}: {values: Record<string, unknown>; compact?: boolean; editor?: MeasurementEditorState}) {
    const {t} = useTranslation();
    const live = useRobotDescription();
    const robot = previewRobotGeometry(live,values);
    const [visual] = useMowerVisual(values.mower_model);
    const dockStyle = resolveDockAppearance(visual.dockAppearance).layered ?? "standard";
    const dockGeometry = dockVisualGeometry(values, robot.wheelXOffset, dockStyle, robot.chassisCenterX);
    const measurementValues = {...DOCK_VISUAL_DEFAULTS,...values,caster_x_offset:resolveCasterPosition(values)};
    const measurement = editor?.active && !editor.invalid ? measurementGeometry(editor.active,robot,measurementValues,dockStyle) : null;
    return <Card className={editor?.active ? "measurement-preview-active" : undefined} size="small" title={t("mowerVisual.title")} style={{marginBottom:16}} data-testid="mower-preview">
        {!compact && <MowerVisualControls chooseStyle/>}
        {!live.fromUrdf ? <Typography.Text type="secondary">{t("mowerVisual.waiting")}</Typography.Text> : <>
            <Flex wrap gap={16}>
                <MowerView dockGeometry={dockGeometry} robot={robot} view="top" showDock={!compact} maxHeight={compact ? 210 : editor?.active ? 190 : 300} measurement={measurement?.view === "top" ? measurement : undefined} transparent={editor?.active === "blade_radius" ? true : undefined}/>
                {!compact && <MowerView dockGeometry={dockGeometry} robot={robot} view="side" showDock maxHeight={editor?.active ? 190 : 300} measurement={measurement?.view === "side" ? measurement : undefined}/>}
            </Flex>
            {editor?.active && <div className="measurement-preview-summary">
                <Typography.Text strong>{t("settingsHardware."+MEASUREMENTS[editor.active].label)}</Typography.Text>
                <Button size="small" onClick={editor.dismiss}>{t("measurementEditor.close")}</Button>
            </div>}
            {measurement && <MeasurementLegend measurement={measurement}/>}
            {editor?.active && !measurement && <Typography.Text type="danger">{t("measurementEditor.invalid")}</Typography.Text>}
            <Typography.Text style={{display:"block",marginTop:12}}>
                {(robot.baseLength*100).toFixed(1)} × {(robot.baseWidth*100).toFixed(1)} × {(robot.baseHeight*100).toFixed(1)} cm
            </Typography.Text>
            <Typography.Text type="secondary" style={{fontSize:12}}>{t("mowerVisual.previewNote")}</Typography.Text>
        </>}
        {editor?.session && <MeasurementDialog session={editor.session} live={live} values={values}
            onCancel={editor.close} onApply={editor.apply}/>}
    </Card>;
}
