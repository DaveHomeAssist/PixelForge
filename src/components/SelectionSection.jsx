export default function SelectionSection({
  selectedShapeRecord,
  selectedShapeFields,
  beginSelectionFieldEdit,
  handleSelectionFieldInput,
  commitSelectionFieldEdits,
  duplicateSelectedShape,
  deleteSelectedShape,
  feedbackClass,
}) {
  const isLine = selectedShapeRecord.shape.type === "line";
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

  return (
    <div className={`pf-section ${feedbackClass("shape-edit")}`}>
      <div className="pf-section-head">Selection</div>
      <div className="pf-section-body">
        <div className="pf-section-lead">
          {isLine ? "Edit the selected line endpoints." : "Adjust the selected vector shape numerically or duplicate/delete it."}
        </div>
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
        <div className="pf-inline-actions" style={{ marginTop: 12 }}>
          <button className={`pf-layer-abtn ${feedbackClass("shape-duplicate")}`} onClick={duplicateSelectedShape}>Duplicate Shape</button>
          <button className={`pf-layer-abtn ${feedbackClass("shape-delete")}`} onClick={deleteSelectedShape}>Delete Shape</button>
        </div>
      </div>
    </div>
  );
}
