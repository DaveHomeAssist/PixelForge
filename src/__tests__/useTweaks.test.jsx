import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import useTweaks, { TWEAK_DEFAULTS, STORAGE_KEY } from "../hooks/useTweaks.js";

describe("useTweaks", () => {
  beforeEach(() => {
    window.localStorage.clear();
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    root.removeAttribute("data-accent");
    root.removeAttribute("data-type");
    root.style.removeProperty("--pf-density");
    root.style.removeProperty("--pf-radius");
    root.style.removeProperty("--pf-radius-sm");
    root.style.removeProperty("--pf-radius-lg");
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns the locked defaults when no prior state is stored", () => {
    const { result } = renderHook(() => useTweaks());
    const [tweaks] = result.current;
    expect(tweaks).toEqual(TWEAK_DEFAULTS);
    expect(tweaks.theme).toBe("light");
    expect(tweaks.accent).toBe("amber");
    expect(tweaks.type).toBe("geist");
    expect(tweaks.density).toBe(1);
    expect(tweaks.radius).toBe(8);
  });

  it("rehydrates persisted tweaks from localStorage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accent: "coral", radius: 12 }),
    );
    const { result } = renderHook(() => useTweaks());
    const [tweaks] = result.current;
    expect(tweaks.accent).toBe("coral");
    expect(tweaks.radius).toBe(12);
    // Unspecified keys fall back to defaults.
    expect(tweaks.theme).toBe("light");
    expect(tweaks.density).toBe(1);
  });

  it("persists state on setTweak so the next hook instance restores it", () => {
    const { result } = renderHook(() => useTweaks());
    act(() => {
      const [, setTweak] = result.current;
      setTweak("accent", "coral");
    });
    expect(result.current[0].accent).toBe("coral");

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).accent).toBe("coral");

    const { result: secondRun } = renderHook(() => useTweaks());
    expect(secondRun.current[0].accent).toBe("coral");
  });

  it("applies data-theme, data-accent, data-type plus CSS custom properties to documentElement on mount", () => {
    renderHook(() => useTweaks());
    const root = document.documentElement;
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.getAttribute("data-accent")).toBe("amber");
    expect(root.getAttribute("data-type")).toBe("geist");
    expect(root.style.getPropertyValue("--pf-density")).toBe("1");
    expect(root.style.getPropertyValue("--pf-radius")).toBe("8px");
    expect(root.style.getPropertyValue("--pf-radius-sm")).toBe("4px");
    expect(root.style.getPropertyValue("--pf-radius-lg")).toBe("12px");
  });

  it("updates the document attributes when tweaks change", () => {
    const { result } = renderHook(() => useTweaks());
    act(() => {
      const [, setTweak] = result.current;
      setTweak("theme", "light");
      setTweak("radius", 14);
    });
    const root = document.documentElement;
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.style.getPropertyValue("--pf-radius")).toBe("14px");
    expect(root.style.getPropertyValue("--pf-radius-sm")).toBe("10px");
    expect(root.style.getPropertyValue("--pf-radius-lg")).toBe("18px");
  });

  it("ignores corrupt localStorage data and falls back to defaults", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not-json}");
    const { result } = renderHook(() => useTweaks());
    expect(result.current[0]).toEqual(TWEAK_DEFAULTS);
  });

  it("resetTweaks restores the locked defaults", () => {
    const { result } = renderHook(() => useTweaks());
    act(() => {
      const [, setTweak] = result.current;
      setTweak("accent", "lime");
      setTweak("radius", 0);
    });
    expect(result.current[0].accent).toBe("lime");

    act(() => {
      const [, , resetTweaks] = result.current;
      resetTweaks();
    });
    expect(result.current[0]).toEqual(TWEAK_DEFAULTS);
  });
});
