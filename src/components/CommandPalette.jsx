import { useMemo, useRef, useState } from "react";
import useFocusTrap from "../hooks/useFocusTrap.js";

export default function CommandPalette({ open, commands, onClose }) {
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(command => `${command.label} ${command.group || ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  // Focus trap owns Escape. The previous window-level Escape handler is
  // dropped to avoid double-firing onClose with the trap's onEscape.
  useFocusTrap(open, containerRef, { restore: true, autoFocus: true, onEscape: onClose });

  if (!open) return null;
  return (
    <div className="pf-modal-backdrop" onClick={onClose}>
      <div
        ref={containerRef}
        className="pf-modal pf-command-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-command-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="pf-modal-head">
          <div className="pf-modal-title" id="pf-command-title">Command Palette</div>
          <div className="pf-modal-copy">Run editor tools, adjustments, filters, view options, and layer effects.</div>
        </div>
        <div className="pf-modal-body">
          <input className="pf-input" autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search commands" aria-label="Search commands" />
          <div className="pf-command-list">
            {filtered.map(command => (
              <button
                key={command.id}
                className="pf-command-item"
                type="button"
                disabled={command.disabled}
                onClick={() => {
                  command.run();
                  onClose();
                }}
              >
                <span>{command.label}</span>
                {command.group && <small>{command.group}</small>}
              </button>
            ))}
          </div>
        </div>
        <div className="pf-modal-actions">
          <button className="pf-mbtn" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
