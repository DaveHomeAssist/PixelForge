import { useEffect, useMemo, useRef, useState } from "react";

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const actionable = useMemo(() => items.map((item, index) => ({ item, index })).filter(entry => !entry.item.separator && !entry.item.disabled), [items]);
  const [activeIndex, setActiveIndex] = useState(actionable[0]?.index ?? -1);

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return undefined;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
    menu.focus();
    const onPointerDown = (event) => {
      if (!menu.contains(event.target)) onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [onClose, x, y]);

  const invoke = (item) => {
    if (item.disabled || item.separator) return;
    item.onClick?.();
    onClose();
  };
  const move = (direction) => {
    if (!actionable.length) return;
    const current = actionable.findIndex(entry => entry.index === activeIndex);
    const next = actionable[(current + direction + actionable.length) % actionable.length];
    setActiveIndex(next.index);
  };

  return (
    <div
      ref={ref}
      className="pf-context-menu"
      role="menu"
      tabIndex={-1}
      style={{ left: x, top: y }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
        if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
        if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); invoke(items[activeIndex]); }
      }}
    >
      {items.map((item, index) => item.separator ? (
        <div key={`sep-${index}`} className="pf-context-sep" role="separator" />
      ) : (
        <button
          key={item.label}
          type="button"
          className={`pf-context-item ${item.danger ? "danger" : ""} ${index === activeIndex ? "active" : ""}`}
          disabled={item.disabled}
          role="menuitem"
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => invoke(item)}
        >
          {item.icon && <item.icon size={13} />}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
