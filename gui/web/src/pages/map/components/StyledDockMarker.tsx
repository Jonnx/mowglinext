import {useTranslation} from "react-i18next";
import {DockGraphic} from "../../../components/robot/DockGraphic";
import {dockBounds, type DockVisualGeometry, type LayeredDockStyle} from "../../../components/robot/dockGeometry";
import {MapPlaneMarker} from "./MapPlaneMarker";

export function StyledDockMarker({longitude,latitude,headingRad,style="standard",geometry}: {longitude:number;latitude:number;headingRad:number;style?:LayeredDockStyle;geometry?:DockVisualGeometry}) {
    const {t}=useTranslation();
    return <MapPlaneMarker bounds={dockBounds("top",style,geometry)} longitude={longitude} latitude={latitude} headingRad={headingRad}
        label={t(style === "worx" ? "mowerVisual.worxDock" : "mowerVisual.dockStyle")} testId="styled-dock-marker" zIndex={998}>
        <DockGraphic geometry={geometry} artwork="map" style={style}/>
    </MapPlaneMarker>;
}
