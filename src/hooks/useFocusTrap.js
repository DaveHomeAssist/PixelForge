import { useEffect, useRef } from "react";

/* eslint-disable react-hooks/refs --
 * We deliberately read document.activeElement from a render-phase guard
 * gated by a "captured-once" ref. React's commit-phase autoFocus on a
 * child input fires BEFORE useLayoutEffect runs, so capturing in any
 * effect-tier hook would see the autofocused child instead of the
 * external opener. The render-phase read is idempotent and only happens
 * the first time `active` flips true (the ref is reset to null when
 * `active` flips false, in the cleanup of the main effect below).
 */

/**
 * useFocusTrap
 *
 * Hand-rolled focus trap for modals and floating panels. PR 2 of the a11y
 * cycle. No new deps, no React experimental APIs (no useEffectEvent).
 *
 * On `active === true`:
 *  - Captures the previously focused element (if `restore`).
 *  - Moves focus to the first focusable element inside `containerRef.current`
 *    (if `autoFocus`).
 *  - Listens for Tab to cycle focus inside the container, wrapping at edges.
 *  - Listens for Escape and calls `options.onEscape` if provided.
 *
 * On `active === false` (or unmount):
 *  - Removes the listener.
 *  - Restores focus to the captured element (if `restore` and the element is
 *    still connected to the DOM).
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "textarea",
  "select",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function isVisible(node) {
  if (!node || !(node instanceof HTMLElement)) return false;
  if (node.hasAttribute("disabled")) return false;
  if (node.getAttribute("aria-hidden") === "true") return false;
  if (node.hidden) return false;
  // We deliberately do not check offsetParent / offsetWidth here: jsdom
  // returns null/0 for those even for visible elements, and the rendered
  // browser case is well-served by [hidden] + aria-hidden + disabled checks.
  return true;
}

function getFocusable(container) {
  if (!container) return [];
  const nodes = container.querySelectorAll(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter(isVisible);
}

export default function useFocusTrap(active, containerRef, options = {}) {
  const { restore = true, autoFocus = true, onEscape } = options;
  const returnTargetRef = useRef(null);
  // Mirror onEscape into a ref so the listener picks up the latest handler
  // without forcing the effect to re-run on every parent render.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => { onEscapeRef.current = onEscape; }, [onEscape]);

  // Capture the opener BEFORE any commit-phase autoFocus inside the modal
  // takes activeElement away from it. We use the React-blessed "init once"
  // ref pattern: the read only happens when returnTargetRef.current is null
  // and `active` is true. The ref is cleared in the main effect's cleanup
  // when `active` flips false, so the next activation captures again.
  if (active && restore && returnTargetRef.current == null && typeof document !== "undefined") {
    returnTargetRef.current = document.activeElement;
  }

  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    if (autoFocus) {
      const focusables = getFocusable(container);
      const target = focusables[0] || container;
      // Some modal containers are non-focusable wrappers; guard the focus call.
      try { target.focus({ preventScroll: true }); } catch { /* ignore */ }
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (typeof onEscapeRef.current === "function") {
          onEscapeRef.current(event);
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = getFocusable(container);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;
      // If focus has escaped the container, pull it back to the first item.
      if (!container.contains(activeEl)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      if (restore) {
        const target = returnTargetRef.current;
        if (target && typeof target.focus === "function" && target.isConnected !== false) {
          try { target.focus({ preventScroll: true }); } catch { /* ignore */ }
        }
        returnTargetRef.current = null;
      }
    };
  }, [active, containerRef, restore, autoFocus]);
}
