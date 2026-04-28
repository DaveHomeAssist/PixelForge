import {
  Eye, EyeOff, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Image, Square,
} from "lucide-react";
import { BLENDS } from "../constants.js";

export default function LayersSection({
  feedbackClass,
  layers,
  activeLayer,
  activeId,
  layerNameInput,
  setLayerNameInput,
  commitActiveLayerName,
  toggleLock,
  duplicateActiveLayer,
  mergeLayerDown,
  canMergeDown,
  addLayer,
  delLayer,
  canMoveUp,
  canMoveDown,
  moveLayer,
  setBlend,
  layerOpacityValue,
  beginLayerOpacityEdit,
  handleLayerOpacityInput,
  commitLayerOpacityEdit,
  dragLayerId,
  dragOverLayerId,
  intentLayerId,
  intentLayerTone,
  suggestedLayerId,
  setActiveId,
  onLayerDragStart,
  onLayerDragEnd,
  onLayerDragEnter,
  onLayerDragLeave,
  onLayerDrop,
  toggleVis,
  onLayerContextMenu,
  onLayerLongPressStart,
  onLayerLongPressCancel,
  collapsed = false,
  onToggle,
}) {
  return (
    <div className={`pf-section ${feedbackClass("layers")}`} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button type="button" className="pf-section-head pf-section-toggle" onClick={onToggle} aria-expanded={!collapsed}>
        <span>Layers</span>
        <span className="pf-section-head-meta">
          <span style={{ fontSize: 8, color: "#95a1a9" }}>{layers.length}</span>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {!collapsed && activeLayer && (
        <div className="pf-layer-row">
          <div className="pf-inline-actions">
            <input
              className={`pf-input ${feedbackClass("layer-rename")}`}
              value={layerNameInput}
              onChange={e => setLayerNameInput(e.target.value)}
              onBlur={commitActiveLayerName}
              onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
              aria-label="Active layer name"
            />
            <button className={`pf-layer-abtn ${feedbackClass("layer-lock")}`} onClick={() => toggleLock(activeId)}>{activeLayer.locked ? "Unlock" : "Lock"}</button>
          </div>
          <div className="pf-inline-actions" style={{ marginTop: 8 }}>
            <button className={`pf-layer-abtn ${feedbackClass("layer-duplicate")}`} onClick={duplicateActiveLayer}>Duplicate</button>
            <button className={`pf-layer-abtn ${feedbackClass("layer-merge")}`} onClick={() => mergeLayerDown(activeId)} disabled={!canMergeDown}>Merge Down</button>
          </div>
        </div>
      )}
      {!collapsed && <div className="pf-layer-actions">
        <button className={`pf-layer-abtn ${feedbackClass("layer-add-raster")}`} onClick={() => addLayer("raster")} title="Add raster layer"><Plus size={10} /><Image size={10} /> Raster</button>
        <button className={`pf-layer-abtn ${feedbackClass("layer-add-vector")}`} onClick={() => addLayer("vector")} title="Add vector layer"><Plus size={10} /><Square size={10} /> Vector</button>
        <button className={`pf-layer-abtn ${feedbackClass("layer-delete")}`} onClick={() => activeId && delLayer(activeId)} disabled={!activeId || layers.length <= 1} title="Delete active layer"><Trash2 size={10} /></button>
        <button className={`pf-layer-abtn ${feedbackClass("layer-up")}`} onClick={() => activeId && moveLayer(activeId, 1)} disabled={!canMoveUp} title="Move layer up"><ChevronUp size={10} /></button>
        <button className={`pf-layer-abtn ${feedbackClass("layer-down")}`} onClick={() => activeId && moveLayer(activeId, -1)} disabled={!canMoveDown} title="Move layer down"><ChevronDown size={10} /></button>
      </div>}

      {!collapsed && activeLayer && (
        <div className="pf-layer-controls">
          <select className="pf-select" style={{ width: 124 }} value={activeLayer.blend} onChange={e => setBlend(activeId, e.target.value)} aria-label="Blend mode">
            {BLENDS.map(blend => <option key={blend} value={blend}>{blend === "source-over" ? "Normal" : blend}</option>)}
          </select>
          <input
            type="range"
            className="pf-slider"
            style={{ flex: 1 }}
            min={0}
            max={100}
            value={layerOpacityValue}
            onPointerDown={beginLayerOpacityEdit}
            onChange={e => handleLayerOpacityInput(e.target.value)}
            onPointerUp={commitLayerOpacityEdit}
            onBlur={commitLayerOpacityEdit}
          />
          <span style={{ fontSize: 9, color: "#6c7a84", minWidth: 28 }}>{layerOpacityValue}%</span>
        </div>
      )}

      {!collapsed && <div className="pf-layers-list">
        {[...layers].reverse().map(layer => (
          <div
            key={layer.id}
            className={`pf-layer ${layer.id === activeId ? "active" : ""} ${dragLayerId === layer.id ? "dragging" : ""} ${dragOverLayerId === layer.id ? "drop-target" : ""} ${intentLayerId === layer.id ? `cue-${intentLayerTone}` : ""} ${suggestedLayerId === layer.id ? "suggested" : ""}`}
            onClick={() => setActiveId(layer.id)}
            draggable
            onDragStart={() => onLayerDragStart(layer.id)}
            onDragEnd={onLayerDragEnd}
            onDragEnter={e => onLayerDragEnter(layer.id, e)}
            onDragOver={e => e.preventDefault()}
            onDragLeave={() => onLayerDragLeave(layer.id)}
            onDrop={() => onLayerDrop(layer.id)}
            onContextMenu={e => onLayerContextMenu?.(e, layer.id)}
            onPointerDown={e => onLayerLongPressStart?.(e, layer.id)}
            onPointerMove={onLayerLongPressCancel}
            onPointerUp={onLayerLongPressCancel}
            onPointerCancel={onLayerLongPressCancel}
          >
            <button className={`pf-layer-vis ${feedbackClass(`layer-visibility-${layer.id}`)}`} onClick={e => { e.stopPropagation(); toggleVis(layer.id); }} title={layer.visible ? "Hide layer" : "Show layer"}>
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <span className="pf-layer-icon" style={{ color: layer.type === "raster" ? "#49697b" : "#8c6740" }}>
              {layer.type === "raster" ? <Image size={12} /> : <Square size={12} />}
            </span>
            <div className="pf-layer-main">
              <div className="pf-layer-name">{layer.name}</div>
              <div className="pf-layer-meta">
                <span className="pf-layer-type">{layer.type === "raster" ? "PX" : "VEC"}</span>
                {suggestedLayerId === layer.id && <span className="pf-layer-tag">Likely</span>}
                {layer.blend !== "source-over" && <span className="pf-layer-tag">{layer.blend}</span>}
                {Math.round(layer.opacity * 100) !== 100 && <span className="pf-layer-tag">{Math.round(layer.opacity * 100)}%</span>}
              </div>
            </div>
            <button className={`pf-layer-lock ${feedbackClass("layer-lock")}`} onClick={e => { e.stopPropagation(); toggleLock(layer.id); }} title={layer.locked ? "Unlock layer" : "Lock layer"}>
              {layer.locked ? "L" : "-"}
            </button>
          </div>
        ))}
      </div>}
    </div>
  );
}
