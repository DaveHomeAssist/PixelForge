import { AlertTriangle } from "lucide-react";
import { getToolTargetLabel } from "../utils.js";

const NON_EDITING_TOOLS = new Set(["hand", "eyedropper"]);

function titleCase(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

export default function CompatibilityBanner({
  activeLayer,
  toolMeta,
  toolCompatible,
  requiredLayerType,
  suggestedLayer,
  focusLayerId,
  addLayer,
  toggleLock,
  setPanelTab,
}) {
  const lockedBlocksTool = !!activeLayer?.locked && !NON_EDITING_TOOLS.has(toolMeta?.id);
  const incompatible = !!activeLayer && !toolCompatible;
  if (!lockedBlocksTool && !incompatible) return null;

  const targetLabel = getToolTargetLabel(toolMeta);
  const title = lockedBlocksTool && incompatible
    ? "Layer locked and tool mismatch"
    : lockedBlocksTool
      ? `${activeLayer.name} is locked`
      : `${toolMeta.label} needs ${targetLabel}`;
  const detail = incompatible
    ? `Current layer is ${activeLayer.name} (${activeLayer.type}). Use ${targetLabel} for ${toolMeta.label}.`
    : `Unlock ${activeLayer.name} before editing it with ${toolMeta.label}.`;

  return (
    <div className={`pf-compat-banner ${lockedBlocksTool ? "danger" : "warn"}`} role="status" aria-live="polite">
      <div className="pf-compat-icon" aria-hidden="true"><AlertTriangle size={14} /></div>
      <div className="pf-compat-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <div className="pf-compat-actions">
        {lockedBlocksTool && (
          <button className="pf-chip-btn" type="button" onClick={() => toggleLock(activeLayer.id)}>
            Unlock Layer
          </button>
        )}
        {incompatible && suggestedLayer && (
          <button className="pf-chip-btn primary" type="button" onClick={() => focusLayerId(suggestedLayer.id)}>
            Switch To {suggestedLayer.name}
          </button>
        )}
        {incompatible && !suggestedLayer && requiredLayerType && (
          <button className="pf-chip-btn primary" type="button" onClick={() => addLayer(requiredLayerType)}>
            Add {titleCase(requiredLayerType)} Layer
          </button>
        )}
        <button className="pf-chip-btn" type="button" onClick={() => setPanelTab("layers")}>
          View Layers
        </button>
      </div>
    </div>
  );
}
