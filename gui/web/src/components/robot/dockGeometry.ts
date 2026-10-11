import type {RobotGeometry} from "../../hooks/useRobotDescription";
import {assemblyBounds} from "./assemblyBounds";
import type {Bounds, RobotView} from "../../utils/robotModel";

// Display geometry only: never used to move/calibrate the saved docking pose.
// Nominal defaults are illustration dimensions, not surveyed hardware values.
export const DOCK_VISUAL_DEFAULTS = {
    dock_visual_length: .67,
    dock_visual_width: .46,
    dock_visual_x_offset: .235,
};
export const DOCK_VISUAL_KEYS = Object.keys(DOCK_VISUAL_DEFAULTS);
export type DockVisualGeometry = {length: number; width: number; centerX: number};
export type LayeredDockStyle = "standard" | "worx";
export const SETUP_DOCK_OPACITY = .18;

/** Front/back is measured from the parked rear axle, positive towards the nose. */
export function dockVisualGeometry(values: Record<string, unknown> = {}, wheelXOffset = 0): DockVisualGeometry {
    const read = (key: keyof typeof DOCK_VISUAL_DEFAULTS, min: number, max: number) => {
        const raw = values[key];
        const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
        return Number.isFinite(n) && n >= min && n <= max ? n : DOCK_VISUAL_DEFAULTS[key];
    };
    return {length: read("dock_visual_length", .1, 3), width: read("dock_visual_width", .1, 3),
        centerX: read("dock_visual_x_offset", -2, 2) + wheelXOffset};
}

export function dockBounds(view: RobotView, style: LayeredDockStyle = "standard", geometry = dockVisualGeometry()): Bounds {
    const {length, width, centerX} = geometry;
    const front = -centerX - length / 2;
    const height = style === "worx" ? .14 : .15;
    // Side-charging pedestal extends right of the tray; retain the tray's centreline.
    const lateralCenter = style === "worx" ? width * (.04 / .56) : 0;
    return view === "top" ? {x: lateralCenter - width / 2, y: front, width, height: length}
        : {x: front, y: -height, width: length, height};
}

const DOCK_TRAY_HEIGHT = .02;
export function previewDockOffsetY(robot: RobotGeometry, view: RobotView): number {
    return view === "top" ? 0 : robot.wheelRadius - (robot.wheelZ ?? 0) + DOCK_TRAY_HEIGHT;
}

/** Include the dock in framing only; robot scale and origin stay fixed. */
export function dockedAssemblyBounds(robot: RobotGeometry, view: RobotView, padding = .05,
    style: LayeredDockStyle = "standard", geometry = dockVisualGeometry({}, robot.wheelXOffset)): Bounds {
    const mower = assemblyBounds(robot, view, 0);
    const dock = dockBounds(view, style, geometry);
    const dockY = dock.y + previewDockOffsetY(robot, view);
    const x = Math.min(mower.x, dock.x) - padding;
    const y = Math.min(mower.y, dockY) - padding;
    return {x, y,
        width: Math.max(mower.x + mower.width, dock.x + dock.width) + padding - x,
        height: Math.max(mower.y + mower.height, dockY + dock.height) + padding - y};
}
