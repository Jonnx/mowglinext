import type {MowerStyle} from "../../hooks/useMowerVisual";

type Shell = {
    files?: Partial<Record<"top" | "side", string>>;
    size: [number, number];
    sizes?: Partial<Record<"top" | "side", [number, number]>>;
    /** Physical projection frame, including real chassis hidden by a wheel.
     * Distinct from alpha bounds: never stretch a remaining panel to full length. */
    frames?: Partial<Record<"top" | "side", [number, number, number, number]>>;
    top: [number, number, number, number];
    side: [number, number, number, number];
};
/** Visible shell bounds in source pixels. Padding is deliberately excluded from
 * physical scaling. Bounds are the tight alpha >220 envelope of each isolated
 * source projection, verified against decoded PNG pixels in Playwright.
 * frames explicitly register hidden chassis extents when alpha bounds are not
 * the whole physical projection. Both opacity modes use the same frame. */
export const SHELLS: Record<MowerStyle, Shell> = {
    // Side wheel bay is open through the top/bottom. The visible front panel
    // ends at x837; the actual chassis rear remains x1211 in this registered
    // projection. Preserve that transparent rear extent in full and map art.
    worx: {files: {side: "worx-side.png"}, size: [1774,887], sizes: {side: [1254,1254]},
        top: [102,67,586,698], side: [44,487,793,295], frames: {side: [44,487,1167,295]}},
    // Separate side source preserves the approved top atlas byte-for-byte.
    // Per-view sources use the same canvas dimensions as the default atlas.
    rm1000: {files: {side: "rm1000-side.png"}, size: [1774,887], top: [73,48,624,804], side: [44,162,1702,622]},
    rounded: {size: [1774,887], top: [75,63,620,788], side: [911,339,825,284]},
    sculpted: {size: [1774,887], top: [106,32,630,829], side: [795,302,931,338]},
    utility: {size: [1774,887], top: [117,48,607,816], side: [831,356,874,261]},
    yardforce: {size: [1774,887], top: [113,29,629,818], side: [852,274,857,371]},
};


export function shellProjectionFrame(style: MowerStyle, view: "top" | "side") {
    return SHELLS[style].frames?.[view] ?? SHELLS[style][view];
}
