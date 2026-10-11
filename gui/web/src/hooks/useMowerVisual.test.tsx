import {act, cleanup, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {useMowerVisual} from "./useMowerVisual";

const key = "mowgli.robot-visual.v1";
let saved: Map<string, string>;
beforeEach(() => {
    saved = new Map();
    vi.stubGlobal("localStorage", {
        getItem: (name: string) => saved.get(name) ?? null,
        setItem: (name: string, value: string) => saved.set(name, value),
    });
});
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

it("keeps existing shell preferences and adds the new dock default", () => {
    saved.set(key, JSON.stringify({style: "utility", transparent: true}));
    const {result} = renderHook(() => useMowerVisual());
    expect(result.current[0]).toEqual({style: "utility", transparent: true, dockAppearance: "styled"});
});

it("persists and shares a hardware chassis/dock pair without resetting transparency", () => {
    saved.set(key, JSON.stringify({style: "rounded", transparent: true}));
    const first = renderHook(() => useMowerVisual());
    const second = renderHook(() => useMowerVisual());
    act(() => first.result.current[1]({style: "yardforce", dockAppearance: "generic"}));
    expect(second.result.current[0]).toEqual({style: "yardforce", dockAppearance: "generic", transparent: true});
    expect(JSON.parse(saved.get(key)!)).toEqual(second.result.current[0]);
    const reloaded = renderHook(() => useMowerVisual());
    expect(reloaded.result.current[0]).toEqual(second.result.current[0]);
});

it("uses safe defaults for retired chassis/dock identifiers", () => {
    saved.set(key, JSON.stringify({style: "retired", dockAppearance: "constructor"}));
    const {result} = renderHook(() => useMowerVisual());
    expect(result.current[0]).toEqual({style: "sculpted", dockAppearance: "styled", transparent: false});
});

it("migrates a saved RM1000 map selection into the shared assembly", () => {
    const {result} = renderHook(() => useMowerVisual("YardForce500", "biltema-rm1000"));
    expect(result.current[0].style).toBe("rm1000");
    expect(result.current[0].dockAppearance).toBe("styled");
});
it("does not overwrite an explicit hardware appearance when legacy map settings load", () => {
    saved.set(key, JSON.stringify({style: "utility", transparent: true}));
    const {result} = renderHook(() => useMowerVisual("BiltemaRM1000", "biltema-rm1000"));
    expect(result.current[0].style).toBe("utility");
});
it("seeds an existing RM1000 hardware installation when it has no saved appearance", () => {
    const {result} = renderHook(() => useMowerVisual("BiltemaRM1000"));
    expect(result.current[0].style).toBe("rm1000");
});

it("pairs the Worx shell with its side-charging dock and restores the basic pair on style change", () => {
    const {result} = renderHook(() => useMowerVisual());
    act(() => result.current[1]({style: "worx"}));
    expect(result.current[0].dockAppearance).toBe("worx");
    const reloaded = renderHook(() => useMowerVisual());
    expect(reloaded.result.current[0].dockAppearance).toBe("worx");
    act(() => result.current[1]({style: "yardforce"}));
    expect(result.current[0].dockAppearance).toBe("styled");
});
it("supplies the matching dock for a stored shell with no dock preference", () => {
    saved.set(key, JSON.stringify({style: "worx"}));
    const {result} = renderHook(() => useMowerVisual());
    expect(result.current[0].dockAppearance).toBe("worx");
});
