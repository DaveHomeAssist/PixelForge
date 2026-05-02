import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import useColorPalettes, { PALETTES_KEY } from "../hooks/useColorPalettes.js";

function prefs(recents = ["#112233", "#445566"]) {
  return {
    uiPrefs: { recents },
    toolPrefs: { recentColors: ["#abcdef"] },
  };
}

describe("useColorPalettes", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves, renames, and deletes palettes", () => {
    const { result } = renderHook(() => useColorPalettes(prefs()));

    let id;
    act(() => {
      id = result.current.savePalette("Work", ["#123456", "#abc"]);
    });
    expect(result.current.palettes[0]).toMatchObject({
      id,
      name: "Work",
      colors: ["#123456", "#aabbcc"],
    });

    act(() => {
      result.current.renamePalette(id, "Renamed");
    });
    expect(result.current.palettes[0].name).toBe("Renamed");

    act(() => {
      result.current.deletePalette(id);
    });
    expect(result.current.palettes).toHaveLength(0);
  });

  it("migrates existing recents on first load", () => {
    const { result } = renderHook(() => useColorPalettes(prefs(["#010203", "#abc"])));

    expect(result.current.recents).toEqual(["#010203", "#aabbcc"]);
    expect(JSON.parse(window.localStorage.getItem(PALETTES_KEY)).recents).toEqual(["#010203", "#aabbcc"]);
  });

  it("persists palettes and recents across remount", () => {
    const first = renderHook(() => useColorPalettes(prefs()));
    let id;
    act(() => {
      first.result.current.addRecent("#fedcba");
      id = first.result.current.savePalette("Saved", ["#111111"]);
    });
    first.unmount();

    const second = renderHook(() => useColorPalettes(prefs(["#000000"])));

    expect(second.result.current.recents[0]).toBe("#fedcba");
    expect(second.result.current.palettes[0]).toMatchObject({ id, name: "Saved", colors: ["#111111"] });
  });
});
