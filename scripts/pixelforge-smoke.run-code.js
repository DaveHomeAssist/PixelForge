async (page) => {
  const baseUrl = page.url() || "http://127.0.0.1:4173/PixelForge/";
  const forceSaveFallback = true;

  if (forceSaveFallback) {
    await page.addInitScript(() => {
      try {
        Object.defineProperty(window, "showSaveFilePicker", {
          configurable: true,
          writable: true,
          value: undefined,
        });
      } catch {
        try {
          window.showSaveFilePicker = undefined;
        } catch {
          // Ignore browsers that refuse this override; the smoke will report it.
        }
      }
      try {
        window.localStorage.removeItem("PixelForge.ai.v1");
        window.localStorage.removeItem("PixelForge.autosave.v3");
      } catch {
        // Storage is best-effort setup only.
      }
    });
  }

  const result = {
    baseUrl,
    forceSaveFallback,
    passes: [],
    failures: [],
    consoleErrors: [],
  };

  const pass = (step, detail = {}) => result.passes.push({ step, detail });
  const fail = (step, detail = {}) => result.failures.push({ step, detail });
  const expect = (condition, step, detail = {}) => {
    if (condition) pass(step, detail);
    else fail(step, detail);
  };

  const importImagePath = "C:/Users/Dave RambleOn/Desktop/01-Projects/pixel-forge-work/scripts/fixtures/smoke-import.svg";

  page.on("console", (msg) => {
    if (msg.type() === "error") result.consoleErrors.push(msg.text());
  });

  const canvas = page.locator("canvas").first();

  const layerCount = async () => page.locator(".pf-layer").count();

  const getDocSize = async () => {
    const chips = await page.locator(".pf-menu-chip").allTextContents();
    for (const chip of chips) {
      const match = chip.match(/(\d+)\s*[xX\u00D7]\s*(\d+)/);
      if (match) return { width: Number(match[1]), height: Number(match[2]), raw: chip.trim() };
    }
    return null;
  };

  const anchorPointer = async () => {
    const box = await canvas.boundingBox();
    if (!box) return false;
    await page.mouse.move(box.x + 24, box.y + 24);
    await page.waitForTimeout(50);
    return true;
  };

  const snapshotCanvas = async () => {
    await anchorPointer();
    return canvas.screenshot();
  };

  const hashBuffer = (bytes) => {
    let hash = 2166136261;
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16);
  };

  const drawStroke = async () => {
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas bounding box not available");
    const startX = box.x + box.width * 0.52;
    const startY = box.y + box.height * 0.55;
    const endX = startX + 90;
    const endY = startY + 70;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(180);
  };

  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const title = await page.title();
    expect(title === "PixelForge", "App shell loads", { title, url: page.url() });

    await page.getByRole("button", { name: "New" }).click();
    await page.getByLabel("Document width").fill("640");
    await page.getByLabel("Document height").fill("480");
    await page.getByLabel("Document background color").fill("#ffffff");
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForTimeout(220);
    const newSize = await getDocSize();
    expect(newSize?.width === 640 && newSize?.height === 480, "New document updates size", { newSize });

    const brushBefore = hashBuffer(await snapshotCanvas());
    await drawStroke();
    const brushAfter = hashBuffer(await snapshotCanvas());
    expect(brushAfter !== brushBefore, "Brush mutates visible canvas", {});

    await page.getByRole("button", { name: /Undo/ }).click();
    await page.waitForTimeout(180);
    const undoCanvas = hashBuffer(await snapshotCanvas());
    expect(undoCanvas !== brushAfter, "Undo changes canvas away from stroked state", {
      matchedInitial: undoCanvas === brushBefore,
    });

    await page.getByRole("button", { name: /Redo/ }).click();
    await page.waitForTimeout(180);
    const redoCanvas = hashBuffer(await snapshotCanvas());
    expect(redoCanvas !== undoCanvas, "Redo changes canvas away from undone state", {
      matchedStroked: redoCanvas === brushAfter,
    });

    const startLayers = await layerCount();
    await page.locator(".pf-layer-actions").getByRole("button", { name: /Vector/ }).click();
    await page.waitForTimeout(120);
    const afterVectorLayers = await layerCount();
    expect(afterVectorLayers === startLayers + 1, "Add Vector increments layer count", {
      startLayers,
      afterVectorLayers,
    });

    await page.locator(".pf-layer-actions").getByRole("button", { name: /Raster/ }).click();
    await page.waitForTimeout(120);
    const afterRasterLayers = await layerCount();
    expect(afterRasterLayers === afterVectorLayers + 1, "Add Raster increments layer count", {
      afterVectorLayers,
      afterRasterLayers,
    });

    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    await imageInput.setInputFiles(importImagePath);
    await page.waitForTimeout(320);
    const afterImportLayers = await layerCount();
    expect(afterImportLayers === afterRasterLayers + 1, "Import creates a layer", {
      afterRasterLayers,
      afterImportLayers,
    });

    await page.getByRole("button", { name: "Resize" }).click();
    await page.getByLabel("Resize width").fill("700");
    await page.getByLabel("Resize height").fill("500");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForTimeout(220);
    const resized = await getDocSize();
    expect(resized?.width === 700 && resized?.height === 500, "Resize updates size", { resized });

    const exportDownloadPromise = page.waitForEvent("download", { timeout: 9000 }).catch(() => null);
    await page.getByRole("button", { name: /Export PNG/ }).click();
    const exportDownload = await exportDownloadPromise;
    if (!exportDownload) {
      fail("Export PNG triggers download", {});
    } else {
      const exportName = await exportDownload.suggestedFilename();
      expect(/\.png$/i.test(exportName), "Export PNG filename is .png", { exportName });
    }

    const saveButton = page.getByRole("button", { name: /Save|Download/ }).first();
    const saveButtonText = (await saveButton.textContent()) || "";
    expect(!forceSaveFallback || /download/i.test(saveButtonText), "Save fallback path is active", { saveButtonText });
    const saveDownloadPromise = page.waitForEvent("download", { timeout: 9000 }).catch(() => null);
    await saveButton.click();
    const saveDownload = await saveDownloadPromise;
    if (!saveDownload) {
      fail("Save fallback triggers download", { saveButtonText });
    } else {
      const saveName = await saveDownload.suggestedFilename();
      expect(/\.pforge$/i.test(saveName), "Save fallback filename is .pforge", { saveName });
    }

    const layersBeforeAi = await layerCount();
    await page.getByRole("button", { name: "Generate with AI" }).click();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.waitForTimeout(260);
    const aiSettingsVisible = await page.getByRole("dialog", { name: /AI settings/i }).isVisible().catch(() => false);
    expect(aiSettingsVisible, "Generate without keys opens AI settings", { aiSettingsVisible });
    if (aiSettingsVisible) {
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.waitForTimeout(160);
    }
    const layersAfterAi = await layerCount();
    expect(layersAfterAi === layersBeforeAi, "AI modal lifecycle preserves editor state", {
      layersBeforeAi,
      layersAfterAi,
    });

    const afterAiBeforeStroke = hashBuffer(await snapshotCanvas());
    await drawStroke();
    const afterAiAfterStroke = hashBuffer(await snapshotCanvas());
    expect(afterAiAfterStroke !== afterAiBeforeStroke, "Editor remains interactive after AI modal close", {});
  } catch (error) {
    fail("Smoke script runtime", { message: error.message, stack: error.stack });
  }

  const depthErrors = result.consoleErrors.filter(msg => /maximum update depth exceeded/i.test(msg));
  expect(depthErrors.length === 0, "No maximum update depth console errors", { depthErrors });

  console.log("PIXELFORGE_SMOKE_RESULT " + JSON.stringify(result));
  return result;
}
