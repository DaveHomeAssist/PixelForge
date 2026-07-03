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

  const importImagePath = "scripts/fixtures/smoke-import.svg";
  const urlFor = (suffix = "") => `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${suffix}`;

  const routeCheck = async (hash, selector, text, step) => {
    await page.goto(urlFor(hash), { waitUntil: "networkidle" });
    const target = page.locator(selector).first();
    await target.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const visible = await target.isVisible().catch(() => false);
    const body = await page.locator("body").innerText().catch(() => "");
    const includesText = !text || body.toLowerCase().includes(text.toLowerCase());
    expect(visible && includesText, step, { url: page.url(), selector, text, bodySnippet: body.slice(0, 220) });
  };

  const endpointCheck = async (path, expectedHash, selector, step) => {
    await page.goto(urlFor(path), { waitUntil: "networkidle" });
    const target = page.locator(selector).first();
    await target.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const visible = await target.isVisible().catch(() => false);
    expect(visible && page.url().includes(expectedHash), step, {
      path,
      url: page.url(),
      expectedHash,
      selector,
    });
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") result.consoleErrors.push(msg.text());
  });
  page.on("dialog", dialog => dialog.accept().catch(() => {}));

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
    expect(/^PixelForge\b/.test(title), "App title loads", { title, url: page.url() });
    expect(await page.locator(".pf-route-home").isVisible().catch(() => false), "Home launcher route renders at root", { url: page.url() });

    await routeCheck("#/templates", ".pf-route-templates", "Template gallery", "Templates route renders");
    await routeCheck("#/guide", ".pf-route-guide", "The friendly guide to PixelForge", "Guide route renders");
    await routeCheck("#/onboarding", ".pf-route-onboarding", "Welcome to", "Onboarding route renders");
    await routeCheck("#/brand", ".pf-route-brand", "PixelForge brand system", "Brand route renders");

    await page.goto(urlFor("#/onboarding"), { waitUntil: "networkidle" });
    await page.locator(".pf-route-onboarding").waitFor({ state: "visible", timeout: 5000 });
    await page.getByRole("button", { name: "Get started" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Start creating" }).click();
    await page.waitForTimeout(120);
    const doneText = await page.locator("body").innerText();
    expect(/Ready to create/.test(doneText), "Onboarding completes to confirmation", { url: page.url() });

    await endpointCheck("home.html", "#/home", ".pf-route-home", "Clean home endpoint resolves");
    await endpointCheck("templates.html", "#/templates", ".pf-route-templates", "Clean templates endpoint resolves");
    await endpointCheck("guide.html", "#/guide", ".pf-route-guide", "Clean guide endpoint resolves");
    await endpointCheck("onboarding.html", "#/onboarding", ".pf-route-onboarding", "Clean onboarding endpoint resolves");
    await endpointCheck("brand.html", "#/brand", ".pf-route-brand", "Clean brand endpoint resolves");
    await endpointCheck("logo.html", "#/brand", ".pf-route-brand", "Clean logo endpoint resolves");
    await endpointCheck("editor.html", "#/editor", ".pf", "Clean editor endpoint resolves");
    await endpointCheck("PixelForge Guide.html", "#/guide", ".pf-route-guide", "Prototype guide filename resolves");
    await endpointCheck("PixelForge Onboarding.html", "#/onboarding", ".pf-route-onboarding", "Prototype onboarding filename resolves");
    await endpointCheck("PixelForge Logo.html", "#/brand", ".pf-route-brand", "Prototype logo filename resolves");
    await endpointCheck("PixelForge.html", "#/editor", ".pf", "Prototype editor filename resolves");

    await page.goto(urlFor("#/editor"), { waitUntil: "networkidle" });
    await page.locator(".pf").first().waitFor({ state: "visible" });

    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "New Document" }).click();
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

    await page.getByRole("tab", { name: /Layers/ }).click();
    await page.locator(".pf-layer-actions").waitFor({ state: "visible", timeout: 5000 });
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

    await page.getByRole("button", { name: "Image", exact: true }).click();
    await page.getByRole("menuitem", { name: "Resize Canvas" }).click();
    await page.getByLabel("Resize width").fill("700");
    await page.getByLabel("Resize height").fill("500");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForTimeout(220);
    const resized = await getDocSize();
    expect(resized?.width === 700 && resized?.height === 500, "Resize updates size", { resized });

    const exportDownloadPromise = page.waitForEvent("download", { timeout: 9000 }).catch(() => null);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export", exact: true }).click();
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
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Generate Image", exact: true }).click();
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

    await page.locator(".pf-layer-actions").getByRole("button", { name: /Raster/ }).click();
    await page.waitForTimeout(120);
    await imageInput.setInputFiles(importImagePath);
    await page.waitForTimeout(320);
    const importedLayerCount = await layerCount();
    const mergeButton = page.getByRole("button", { name: "Merge Down" }).first();
    if (await mergeButton.isEnabled()) await mergeButton.click();
    await page.waitForTimeout(180);
    expect(await layerCount() === importedLayerCount - 1, "Merge Down reduces imported raster layer count", {
      before: importedLayerCount,
      after: await layerCount(),
    });
    await page.getByTitle("Marquee Select (M)").click();
    const cbox = await canvas.boundingBox();
    if (!cbox) throw new Error("Canvas bounding box not available for selection clipboard smoke");
    await page.mouse.move(cbox.x + cbox.width * 0.45, cbox.y + cbox.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(cbox.x + cbox.width * 0.58, cbox.y + cbox.height * 0.58, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.press("Meta+X");
    await page.waitForTimeout(220);
    const cutStatus = await page.locator(".pf-status").textContent();
    expect(/Clipboard .*cut/i.test(cutStatus || ""), "Cmd X records current selection in PixelForge clipboard", { cutStatus });
    const layersBeforePaste = await layerCount();
    await page.keyboard.press("Meta+V");
    await page.waitForTimeout(260);
    let pasteStatus = await page.locator(".pf-status").textContent();
    if (!/Clipboard .*pasted/i.test(pasteStatus || "")) {
      await page.keyboard.press("Control+V");
      await page.waitForTimeout(260);
      pasteStatus = await page.locator(".pf-status").textContent();
    }
    expect(/Clipboard .*pasted/i.test(pasteStatus || ""), "Cmd/Ctrl V pastes current selection clipboard", { pasteStatus });
    expect(await layerCount() === layersBeforePaste, "Selection paste stays in active raster layer instead of stale image layer", {
      before: layersBeforePaste,
      after: await layerCount(),
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
