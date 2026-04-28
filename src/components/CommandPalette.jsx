import { useEffect, useMemo, useState } from "react";

export default function CommandPalette({ open, commands, onClose }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(command => `${command.label} ${command.group || ""}`.toLowerCase().includes(q));
  }, [commands, query]);
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="pf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="pf-modal pf-command-modal">
        <div className="pf-modal-head">
          <div className="pf-modal-title">Command Palette</div>
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
