import { ChevronDown, ChevronRight } from "lucide-react";

export default function SelectionSection({
  selectedShapeType,
  selectedShapeFields,
  beginSelectionFieldEdit,
  handleSelectionFieldInput,
  commitSelectionFieldEdits,
  duplicateSelectedShape,
  deleteSelectedShape,
  feedbackClass,
  collapsed = false,
  onToggle,
}) {
  const isLine = selectedShapeType === "line";
  const makeInput = (field, label) => (
    <input
      className="pf-input"
      type="number"
      value={selectedShapeFields?.[field] ?? ""}
      onFocus={beginSelectionFieldEdit}
      onChange={e => handleSelectionFieldInput(field, e.target.value)}
      onBlur={commitSelectionFieldEdits}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
      aria-label={label}
    />
  );
  const makeColorRow = (field, enabledField, label) => (
    <div className="pf-prop-row">
      <label className="pf-checkbox-row">
        <input
          type="checkbox"
          checked={!!selectedShapeFields?.[enabledField]}
          onChange={e => {
            beginSelectionFieldEdit();
            handleSelectionFieldInput(enabledField, e.target.checked);
            commitSelectionFieldEdits();
          }}
        />
        <span>{label}</span>
      </label>
      <input
        className="pf-color-inline"
        type="color"
        value={selectedShapeFields?.[field] || "#000000"}
        disabled={!selectedShapeFields?.[enabledField]}
        onFocus={beginSelectionFieldEdit}
        onChange={e => handleSelectionFieldInput(field, e.target.value)}
        onBlur={commitSelectionFieldEdits}
        aria-label={`${label} color`}
      />
    </div>
  );

  return (
    <div className={`pf-section ${feedbackClass("shape-edit")}`}>
      <button type="button" className="pf-section-head pf-section-toggle" onClick={onToggle} aria-expanded={!collapsed}>
        <span>Selection</span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && <div className="pf-section-body">
        {isLine ? (
          <div className="pf-mini-grid four">
            {makeInput("x1", "Line start X")}
            {makeInput("y1", "Line start Y")}
            {makeInput("x2", "Line end X")}
            {makeInput("y2", "Line end Y")}
          </div>
        ) : (
          <div className="pf-mini-grid four">
            {makeInput("x", "Shape X")}
            {makeInput("y", "Shape Y")}
            {makeInput("w", "Shape width")}
            {makeInput("h", "Shape height")}
          </div>
        )}
        {!isLine && makeColorRow("fill", "fillOn", "Fill")}
        {makeColorRow("stroke", "strokeOn", "Stroke")}
        <div className="pf-prop-row">
          <span className="pf-prop-label">Stroke Width</span>
          {makeInput("strokeWidth", "Stroke width")}
        </div>
        <div className="pf-inline-actions" style={{ marginTop: 12 }}>
          <button className={`pf-layer-abtn ${feedbackClass("shape-duplicate")}`} onClick={duplicateSelectedShape}>Duplicate Shape</button>
          <button className={`pf-layer-abtn ${feedbackClass("shape-delete")}`} onClick={deleteSelectedShape}>Delete Shape</button>
        </div>
      </div>}
    </div>
  );
}
