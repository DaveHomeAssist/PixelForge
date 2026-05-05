import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

/**
 * CommandPalette
 *
 * PR 3 visual refresh plus arrow-key navigation. Existing command list stays
 * canonical; the new shape adds:
 *   - magnifying-glass icon and "esc" hint in the header,
 *   - filtered list grouped by command.group section header,
 *   - ArrowDown / ArrowUp navigation, Enter activates, Escape closes,
 *   - footer hint chips for the keyboard contract.
 *
 * Concern 2 fix lives in the parent (PixelForge.jsx): the cmd-dark entry now
 * dispatches setTweak("theme", ...) rather than toggleWorkspacePref("darkMode").
 * No new useEffectEvent.
 */

function CommandPaletteInner({ commands, onClose }) {
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => `${c.label} ${c.group || ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  // Clamp idx during render rather than via a setState-in-effect: when the
  // filtered list shrinks below the current idx, snap back to 0.
  const clampedIdx = idx > Math.max(0, filtered.length - 1) ? 0 : idx;

  // Focus the search input when this inner mounts (mount happens iff open).
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  // Scroll the active item into view when idx changes.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-idx="${clampedIdx}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [clampedIdx]);

  // Group filtered commands while preserving the source order. Each item gets
  // a flat index so arrow-key nav stays stable across collapsed sections.
  const groups = [];
  const indexFor = new Map();
  filtered.forEach((cmd, flatIdx) => {
    const key = cmd.group || "Other";
    let bucket = groups.find(g => g.label === key);
    if (!bucket) {
      bucket = { label: key, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(cmd);
    indexFor.set(cmd, flatIdx);
  });

  const runIndex = (i) => {
    const cmd = filtered[i];
    if (!cmd || cmd.disabled) return;
    if (typeof cmd.run === "function") cmd.run();
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx(i => Math.min(i + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx(i => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runIndex(clampedIdx);
    }
  };

  return (
    <div
      className="pf-cmd-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
    >
      <div className="pf-cmd" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="pf-cmd-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, search tools, settings…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
            aria-label="Search commands"
          />
          <kbd className="pf-cmd-esc">esc</kbd>
        </div>
        <div className="pf-cmd-list" ref={listRef}>
          {groups.map(group => (
            <div key={group.label}>
              <div className="pf-cmd-section">{group.label}</div>
              {group.items.map((cmd) => {
                const flatIdx = indexFor.get(cmd);
                const active = flatIdx === clampedIdx;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    data-cmd-idx={flatIdx}
                    className={"pf-cmd-item" + (active ? " active" : "")}
                    disabled={cmd.disabled}
                    onMouseEnter={() => setIdx(flatIdx)}
                    onClick={() => runIndex(flatIdx)}
                  >
                    <span>{cmd.label}</span>
                    {cmd.group && <small>{cmd.group}</small>}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="pf-cmd-empty">
              No commands match "{query}"
            </div>
          )}
        </div>
        <div className="pf-cmd-foot">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

export default function CommandPalette({ open, commands, onClose }) {
  if (!open) return null;
  // Mount only while open so the inner effects (focus + state init) re-run on
  // each open. This avoids any setState-in-effect across the open boundary.
  return <CommandPaletteInner commands={commands} onClose={onClose} />;
}
