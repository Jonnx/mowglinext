import type {PartId} from "./partAssets";

/** Artwork registration belongs beside the image bounds, not in the renderer.
 * Anchors are fractions of the full cropped footprint. Offsets are metres in
 * robot X/Y, added to the operator's display adjustment (never the dock pose).
 * Mower shells use shellAssets.ts frames for the corresponding registration.
 */
export type DockArtwork = {
    part: PartId;
    height: number;
    origin: "rearAxle" | "chassisCenter";
    offset: {forward: number; left: number};
    topAnchor: [number, number];
    sideAnchor: [number, number];
};
export const DOCK_ARTWORK = {
    // Built-in parked alignment: footprint centre 220 mm ahead of rear axle.
    standard: {part: "dock", height: .15, origin: "rearAxle",
        offset: {forward: .220, left: 0}, topAnchor: [.5, .5], sideAnchor: [.5, 1]},
    // Slatted platform centre x=355, cropped source starts x=47 and is 721px
    // wide. The charging pedestal is outside this reference, within the crop.
    worx: {part: "dock-worx", height: .14, origin: "chassisCenter",
        offset: {forward: 0, left: 0}, topAnchor: [(355 - 47) / 721, .5], sideAnchor: [.5, 1]},
} satisfies Record<string, DockArtwork>;
export type LayeredDockStyle = keyof typeof DOCK_ARTWORK;
