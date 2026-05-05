import { useEffect, useRef, useState } from "react";
import {
  Hammer,
  ChevronDown,
  Save,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Command,
  Sun,
  Moon,
  Sliders,
} from "lucide-react";

/**
 * TopBar
 *
 * PR 3 of the Pixel Forge redesign cycle (2026-05-04). Replaces the desktop
 * top region of EditorMenu. The mobile-menu sheet inside EditorMenu is
 * preserved separately and rendered alongside this component.
 *
 * Decisions locked in plan section 9:
 *   - Brand stays "Pixel Forge" (two words) with the existing Lucide icon.
 *   - Class names keep the pf- prefix.
 *   - Cmd+K chip dispatches to the existing setCommandOpen state setter.
 *   - Theme chip toggles useTweaks.theme via setTweak("theme", ...).
 *   - Sliders chip ports onOpenTweaks from the legacy EditorMenu.
 *
 * No new useEffectEvent usage. Plain useEffect plus useCallback patterns.
 */

function MenuDropdown({ id, label, items, openMenu, setOpenMenu, runItem }) {
  const open = openMenu === id;
  return (
    <div className="pf-menu-dropdown">
      <button
        type="button"
        className={"pf-menu-btn" + (open ? " active" : "")}
        onClick={() => setOpenMenu(open ? null : id)}
        onMouseEnter={() => openMenu && setOpenMenu(id)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
        <ChevronDown size={11} className="chev" />
      </button>
      {open && (
        <div className="pf-menu-popover" role="menu" aria-label={`${label} menu`} onMouseLeave={() => setOpenMenu(null)}>
          {items.map((item, i) => {
            if (item === "rule" || item?.kind === "rule") {
              return <div key={`rule-${i}`} className="pf-menu-rule" />;
            }
            return (
              <button
                key={item.key || item.label}
                type="button"
                role="menuitem"
                className="pf-menu-item"
                disabled={item.disabled}
                onClick={() => runItem(item)}
              >
                <span>{item.label}</span>
                {item.kbd && <kbd>{item.kbd}</kbd>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TopBar({
  docName,
  zoom,
  setZoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  theme,
  onToggleTheme,
  onOpenCommand,
  onOpenTweaks,
  onSave,
  onExport,
  isDirty,
  savedAt,
  docW,
  docH,
  saveButtonLabel = "Save",
  saveButtonTitle = "Save project",
  fileItems = [],
  editItems = [],
  imageItems = [],
  viewItems = [],
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const onPointer = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpenMenu(null);
    };
    const onEscape = (e) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  const runItem = (item) => {
    setOpenMenu(null);
    if (typeof item.run === "function") item.run();
  };

  const zoomPct = Math.round((zoom || 0) * 100);
  const handleZoomOut = () => {
    if (typeof onZoomOut === "function") onZoomOut();
    else if (typeof setZoom === "function") setZoom(Math.max(0.1, (zoom || 1) - 0.25));
  };
  const handleZoomIn = () => {
    if (typeof onZoomIn === "function") onZoomIn();
    else if (typeof setZoom === "function") setZoom(Math.min(8, (zoom || 1) + 0.25));
  };
  const handleZoomFit = () => {
    if (typeof onZoomFit === "function") onZoomFit();
    else if (typeof setZoom === "function") setZoom(1);
  };

  return (
    <div className="pf-topbar" ref={rootRef}>
      <div className="pf-brand">
        <div className="pf-brand-mark" aria-hidden="true">
          <Hammer size={13} />
        </div>
        <div className="pf-brand-name">Pixel Forge</div>
        {docName && <span className="pf-brand-doc">{docName}</span>}
      </div>

      <div className="pf-menu-row">
        <MenuDropdown id="file"  label="File"  items={fileItems}  openMenu={openMenu} setOpenMenu={setOpenMenu} runItem={runItem} />
        <MenuDropdown id="edit"  label="Edit"  items={editItems}  openMenu={openMenu} setOpenMenu={setOpenMenu} runItem={runItem} />
        <MenuDropdown id="image" label="Image" items={imageItems} openMenu={openMenu} setOpenMenu={setOpenMenu} runItem={runItem} />
        <MenuDropdown id="view"  label="View"  items={viewItems}  openMenu={openMenu} setOpenMenu={setOpenMenu} runItem={runItem} />
      </div>

      <div className="pf-topbar-sep" />

      <button
        type="button"
        className="pf-menu-btn"
        onClick={onSave}
        title={saveButtonTitle}
      >
        <Save size={13} /> {saveButtonLabel}
      </button>
      <button
        type="button"
        className="pf-menu-btn"
        onClick={onExport}
        title="Export"
      >
        <Download size={13} /> Export
      </button>

      <div className="pf-spacer" />

      <span className="pf-chip pf-chip-dim" aria-label="Document dimensions">{docW} × {docH}</span>
      <span className="pf-chip">{isDirty ? "Edited" : "Saved"}{savedAt ? ` · ${savedAt}` : ""}</span>

      <div className="pf-zoom-group" role="group" aria-label="Zoom controls">
        <button type="button" onClick={handleZoomOut} aria-label="Zoom out"><ZoomOut size={12} /></button>
        <span className="pf-zval">{zoomPct}%</span>
        <button type="button" onClick={handleZoomIn} aria-label="Zoom in"><ZoomIn size={12} /></button>
        <button type="button" onClick={handleZoomFit} title="Fit" aria-label="Fit document"><Maximize2 size={12} /></button>
      </div>

      <button
        type="button"
        className="pf-chip pf-chip-action"
        onClick={onOpenTweaks}
        title="Tweaks (Cmd/Ctrl+,)"
        aria-label="Open tweaks"
      >
        <Sliders size={12} />
      </button>

      <button
        type="button"
        className="pf-chip pf-chip-action"
        onClick={onOpenCommand}
        title="Command palette (Cmd/Ctrl+K)"
      >
        <Command size={11} /> ⌘K
      </button>

      <button
        type="button"
        className="pf-chip pf-chip-action"
        onClick={onToggleTheme}
        title="Toggle theme"
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
      </button>
    </div>
  );
}
