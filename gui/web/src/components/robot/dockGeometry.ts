import type {RobotGeometry} from "../../hooks/useRobotDescription";
import {assemblyBounds} from "./assemblyBounds";
import type {Bounds, RobotView} from "../../utils/robotModel";

// Nominal generic dock illustration, not measured robot/collision geometry.
// Dock pose is the parked robot's base_link. Head is at +X, entry at -X.
export const DOCK_LENGTH = .67, DOCK_WIDTH = .46, DOCK_HEIGHT = .15;
export function dockBounds(view:RobotView):Bounds {
    return view === "top" ? {x:-DOCK_WIDTH/2,y:-.57,width:DOCK_WIDTH,height:DOCK_LENGTH}
        : {x:-.57,y:-DOCK_HEIGHT,width:DOCK_LENGTH,height:DOCK_HEIGHT};
}

// The artwork's parking tray is nominally 20 mm thick. Place its top at the
// tyre contact plane in setup previews, without moving any URDF component.
const DOCK_TRAY_HEIGHT = .02;
export function previewDockOffsetY(robot: RobotGeometry, view: RobotView): number {
    return view === "top" ? 0 : robot.wheelRadius - (robot.wheelZ ?? 0) + DOCK_TRAY_HEIGHT;
}

/** Include the decorative dock in framing only; robot scale and origin stay fixed. */
export function dockedAssemblyBounds(robot: RobotGeometry, view: RobotView, padding = .05): Bounds {
    const mower = assemblyBounds(robot, view, 0);
    const dock = dockBounds(view);
    const dockY = dock.y + previewDockOffsetY(robot, view);
    const x = Math.min(mower.x, dock.x) - padding;
    const y = Math.min(mower.y, dockY) - padding;
    return {x, y,
        width: Math.max(mower.x + mower.width, dock.x + dock.width) + padding - x,
        height: Math.max(mower.y + mower.height, dockY + dock.height) + padding - y};
}
