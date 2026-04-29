async (page) => {
  const baseUrl = page.url() || "http://127.0.0.1:4173/PixelForge/";
  const screenshotRoot = "artifacts/smoke-visual";

  const viewports = [
    { key: "desktop", width: 1440, height: 900 },
    { key: "tablet", width: 1024, height: 768 },
    { key: "phone-portrait", width: 390, height: 844 },
    { key: "phone-landscape", width: 844, height: 390 },
  ];

  const result = { baseUrl, checks: [], failures: [] };

  const fail = (viewport, check, message, selector) => {
    result.failures.push({ viewport, check, message, selector });
  };

  const pass = (viewport, check, selector, screenshotPath, recommendedFix = "None") => {
    result.checks.push({ viewport, check, selector, screenshotPath, recommendedFix });
  };

  const expect = (condition, info) => {
    if (condition) {
      pass(info.viewport, info.check, info.selector, info.screenshotPath, info.recommendedFix);
    } else {
      fail(info.viewport, info.check, info.message, info.selector);
    }
  };

  const hasHorizontalOverflow = async () => page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });

  try {
    for (const viewport of viewports) {
      const viewportLabel = `${viewport.key} ${viewport.width}x${viewport.height}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      await page.locator(".pf").first().waitFor({ state: "visible" });
      const screenshotPath = `${screenshotRoot}/${viewport.key}-${viewport.width}x${viewport.height}.png`;

      expect(await page.locator(".pf").first().isVisible(), {
        viewport: viewportLabel,
        check: "Editor shell renders",
        selector: ".pf",
        screenshotPath,
        message: "Main editor shell did not render",
        recommendedFix: "Confirm app root mounts and .pf container is visible at this viewport.",
      });

      const canvas = page.locator(".pf-viewport canvas").first();
      const canvasVisible = await canvas.isVisible();
      let canvasUsable = false;
      if (canvasVisible) {
        const box = await canvas.boundingBox();
        canvasUsable = !!box && box.width > 32 && box.height > 32;
      }
      expect(canvasUsable, {
        viewport: viewportLabel,
        check: "Canvas is visible",
        selector: ".pf-viewport canvas",
        screenshotPath,
        message: "Canvas was hidden or collapsed",
        recommendedFix: "Ensure .pf-viewport min-height and canvas sizing logic hold for this breakpoint.",
      });

      const toolbarButtons = page.locator(".pf-toolbar .pf-tbtn");
      const toolbarCount = await toolbarButtons.count();
      const fileButton = page.getByRole("button", { name: "File", exact: true });
      const mobileMenuButton = page.getByRole("button", { name: "Open menu", exact: true });
      const fileVisible = await fileButton.isVisible().catch(() => false);
      const mobileMenuVisible = await mobileMenuButton.isVisible().catch(() => false);
      if (fileVisible) await fileButton.scrollIntoViewIfNeeded();
      if (!fileVisible && mobileMenuVisible) await mobileMenuButton.scrollIntoViewIfNeeded();
      const toolbarReachable = toolbarCount >= 6 && (fileVisible || mobileMenuVisible);
      expect(toolbarReachable, {
        viewport: viewportLabel,
        check: "Primary toolbar controls are reachable",
        selector: ".pf-toolbar .pf-tbtn, button:has-text('File'), button[aria-label='Open menu']",
        screenshotPath,
        message: `Expected >=6 tool buttons and visible menu control, got count=${toolbarCount}`,
        recommendedFix: "Adjust toolbar/menu wrapping so core actions remain reachable.",
      });

      const overflow = await hasHorizontalOverflow();
      expect(!overflow, {
        viewport: viewportLabel,
        check: "No horizontal page overflow",
        selector: "html",
        screenshotPath,
        message: "Detected horizontal overflow",
        recommendedFix: "Audit fixed-width containers and overflow-x settings for this breakpoint.",
      });

      if (viewport.width <= 920) {
        const tabs = page.locator(".pf-mobile-tabs");
        const tabsVisible = await tabs.isVisible();
        let tabsUsable = false;
        if (tabsVisible) {
          await page.getByRole("button", { name: "Layers", exact: true }).click();
          const layersVisible = await page.locator(".pf-layers-list").isVisible();
          await page.getByRole("button", { name: "Colors", exact: true }).click();
          const colorsVisible = await page.locator(".pf-swatches").isVisible();
          tabsUsable = layersVisible && colorsVisible;
        }
        expect(tabsVisible && tabsUsable, {
          viewport: viewportLabel,
          check: "Mobile/compact panels remain usable",
          selector: ".pf-mobile-tabs, .pf-layers-list, .pf-swatches",
          screenshotPath,
          message: "Mobile tabs were hidden or panel content did not switch correctly",
          recommendedFix: "Verify mobile tab visibility and section toggling rules at <=920px.",
        });
      } else {
        const rightPanelVisible = await page.locator(".pf-rpanel").isVisible();
        expect(rightPanelVisible, {
          viewport: viewportLabel,
          check: "Desktop right panel remains usable",
          selector: ".pf-rpanel",
          screenshotPath,
          message: "Right panel not visible on non-mobile viewport",
          recommendedFix: "Check .pf-body flex layout and .pf-rpanel width constraints.",
        });
      }

      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  } catch (error) {
    result.failures.push({ viewport: "runtime", check: "script", message: error.message });
  }

  console.log("PIXELFORGE_VISUAL_RESULT " + JSON.stringify(result));
  return result;
}
