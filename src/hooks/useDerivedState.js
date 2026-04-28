import { useEffect } from "react";
import { TOOLS, TOOL_COPY, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "../constants.js";
import { getToolRequirement } from "../utils.js";
import { getResizeCursor } from "../shapes.js";

/**
 * useDerivedState
 *
 * Encapsulates the derived values, "next actions" suggestions, cursor
 * computation, and panel-tab sync effects previously inlined in
 * PixelForge.jsx (Phase 4 refactor). Pure refactor — behavior should match
 * the previous inlined implementation exactly.
 */
export default function useDerivedState({
  // state inputs
  layers,
  activeId,
  tool,
  hoverToolId,
  selectedShape,
  selectionDraft,
  opacityDraft,
  isCompactUI,
  isPanning,
  isSpaceHeld,
  hoverHandle,
  mobilePanelTab,
  prefs,
  isDirty,
  modal,
  starterDismissed,
  preferredRasterTool,
  preferredVectorTool,
  // behavior functions from parent
  pickLikelyLayerId,
  focusLayerId,
  focusLayerType,
  selectTool,
  duplicateSelectedShape,
  addLayer,
  handleImportImage,
  handleExport,
  handleSave,
  canUseFileSave,
  // setters
  setMobilePanelTab,
  setStarterDismissed,
}) {
  const activeLayer = layers.find(l => l.id === activeId);
  const selectedShapeFields = selectionDraft;
  const toolMeta = TOOLS.find(t => t.id === tool) || TOOLS[0];
  const hoverToolMeta = TOOLS.find(t => t.id === hoverToolId) || null;
  const panelToolMeta = hoverToolMeta || toolMeta;
  const panelToolCopy = TOOL_COPY[panelToolMeta.id];
  const toolCompatible = !activeLayer || (activeLayer.type === "raster" ? toolMeta.raster : toolMeta.vector);
  const activeIndex = layers.findIndex(l => l.id === activeId);
  const canMoveDown = activeIndex > 0;
  const canMoveUp = activeIndex >= 0 && activeIndex < layers.length - 1;
  const canMergeDown = !!activeLayer && activeLayer.type === "raster" && activeIndex > 0 && layers[activeIndex - 1]?.type === "raster";
  const requiredLayerType = getToolRequirement(tool);
  const suggestedLayerId = requiredLayerType && activeLayer?.type !== requiredLayerType ? pickLikelyLayerId(requiredLayerType) : null;
  const suggestedLayer = suggestedLayerId ? layers.find(l => l.id === suggestedLayerId) : null;
  const recentColors = prefs.toolPrefs.recentColors || [DEFAULT_PRIMARY, DEFAULT_SECONDARY];
  const recentBrushSizes = prefs.toolPrefs.recentBrushSizes || [];
  const recentDocPresets = prefs.docPrefs.recentDocPresets || [];
  const layerOpacityValue = opacityDraft ?? (activeLayer ? Math.round(activeLayer.opacity * 100) : 100);
  const docSignals = layers.reduce((acc, layer) => {
    if (layer.type === "vector") {
      acc.vectorShapes += layer.shapeCount;
      return acc;
    }
    if (!["background", "empty"].includes(layer.contentHint || "edited")) acc.editedRasterLayers += 1;
    return acc;
  }, { vectorShapes: 0, editedRasterLayers: 0 });
  const isBlankDocument = docSignals.vectorShapes === 0 && docSignals.editedRasterLayers === 0;
  const hasArtwork = !isBlankDocument;
  const nextActions = [];
  if (suggestedLayer) {
    nextActions.push({
      key: "switch-layer",
      label: `Switch to ${suggestedLayer.name}`,
      detail: `${toolMeta.label} belongs on a ${suggestedLayer.type} layer.`,
      onClick: () => focusLayerId(suggestedLayer.id),
    });
  }
  if (isBlankDocument) {
    nextActions.push(
      {
        key: "start-painting",
        label: "Start Painting",
        detail: `Jump into ${TOOLS.find(item => item.id === preferredRasterTool)?.label || "Brush"} on your raster layer.`,
        onClick: () => { focusLayerType("raster"); selectTool(preferredRasterTool); },
      },
      {
        key: "add-shape",
        label: "Add Shape",
        detail: `Switch to ${TOOLS.find(item => item.id === preferredVectorTool)?.label || "Rectangle"} on your vector layer.`,
        onClick: () => { focusLayerType("vector"); selectTool(preferredVectorTool); },
      },
      {
        key: "import-image",
        label: "Import Image",
        detail: "Bring in a reference, texture, or base image.",
        onClick: handleImportImage,
      },
    );
  } else if (selectedShape) {
    nextActions.push(
      {
        key: "move-selection",
        label: "Move Selection",
        detail: "Switch to the move tool and keep editing the active shape.",
        onClick: () => selectTool("move"),
      },
      {
        key: "duplicate-selection",
        label: "Duplicate Shape",
        detail: "Branch the selected shape before refining.",
        onClick: duplicateSelectedShape,
      },
      {
        key: "export-work",
        label: "Export PNG",
        detail: "Capture the current composition as an image.",
        onClick: handleExport,
      },
    );
  } else if (tool === "brush" || tool === "eraser") {
    nextActions.push(
      {
        key: "shape-pass",
        label: "Switch To Shapes",
        detail: "Block in geometry on the vector layer.",
        onClick: () => { focusLayerType("vector"); selectTool(preferredVectorTool); },
      },
      {
        key: "new-raster",
        label: "Add Raster Layer",
        detail: "Keep paint strokes separate from the background.",
        onClick: () => addLayer("raster"),
      },
    );
    if (isDirty) {
      nextActions.push({
        key: "save-progress",
        label: "Save Progress",
        detail: canUseFileSave ? "Write the project back to disk." : "Download the current project file.",
        onClick: handleSave,
      });
    }
  } else if (requiredLayerType === "vector") {
    nextActions.push(
      {
        key: "move-tool",
        label: "Adjust Placement",
        detail: "Use the move tool for handles and precise placement.",
        onClick: () => selectTool("move"),
      },
      {
        key: "export-work",
        label: "Export PNG",
        detail: "Preview the composition outside the editor.",
        onClick: handleExport,
      },
    );
  } else if (isDirty) {
    nextActions.push(
      {
        key: "save-progress",
        label: "Save Progress",
        detail: canUseFileSave ? "Write the current PixelForge project to disk." : "Download the current PixelForge project.",
        onClick: handleSave,
      },
      {
        key: "export-work",
        label: "Export PNG",
        detail: "Flatten the visible layers to an image.",
        onClick: handleExport,
      },
    );
  }
  const visibleNextActions = nextActions.slice(0, 3);
  const cursorStyle = isPanning
    ? "grabbing"
    : isSpaceHeld
      ? "grab"
      : tool === "move" && hoverHandle
        ? getResizeCursor(hoverHandle)
        : tool === "move" && selectedShape
          ? "move"
          : tool === "eyedropper"
            ? "crosshair"
            : ["brush", "eraser", "rect", "ellipse", "line"].includes(tool)
              ? "crosshair"
              : "default";
  const showNextSection = visibleNextActions.length > 0;
  const showStarterOverlay = isBlankDocument && prefs.behaviorPrefs.showStarterActions && !modal && !starterDismissed;
  const showDesktopSection = (section) => !isCompactUI || mobilePanelTab === section;

  useEffect(() => {
    if (!isCompactUI) return;
    if (selectedShape) {
      setMobilePanelTab("selection");
      return;
    }
    if (!toolCompatible && suggestedLayer) {
      setMobilePanelTab("layers");
      return;
    }
    if (isBlankDocument) {
      setMobilePanelTab("next");
    }
  }, [isBlankDocument, isCompactUI, selectedShape, suggestedLayer, toolCompatible, setMobilePanelTab]);

  useEffect(() => {
    if (!isCompactUI) return;
    if (mobilePanelTab === "next" && !showNextSection) {
      setMobilePanelTab(selectedShape ? "selection" : "tool");
      return;
    }
    if (mobilePanelTab === "selection" && !selectedShape) {
      setMobilePanelTab(showNextSection ? "next" : "tool");
    }
  }, [isCompactUI, mobilePanelTab, selectedShape, showNextSection, setMobilePanelTab]);

  useEffect(() => {
    if (!isBlankDocument) setStarterDismissed(false);
  }, [isBlankDocument, setStarterDismissed]);

  return {
    activeLayer,
    selectedShapeFields,
    toolMeta,
    hoverToolMeta,
    panelToolMeta,
    panelToolCopy,
    toolCompatible,
    activeIndex,
    canMoveDown,
    canMoveUp,
    canMergeDown,
    requiredLayerType,
    suggestedLayerId,
    suggestedLayer,
    recentColors,
    recentBrushSizes,
    recentDocPresets,
    layerOpacityValue,
    docSignals,
    isBlankDocument,
    hasArtwork,
    nextActions,
    visibleNextActions,
    cursorStyle,
    showNextSection,
    showStarterOverlay,
    showDesktopSection,
  };
}
