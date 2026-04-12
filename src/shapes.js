import { clamp, dist } from "./utils.js";

export function getShapeBounds(shape) {
  if (!shape) return null;
  if (shape.type === "line") {
    return {
      left: Math.min(shape.x1, shape.x2),
      top: Math.min(shape.y1, shape.y2),
      right: Math.max(shape.x1, shape.x2),
      bottom: Math.max(shape.y1, shape.y2),
      width: Math.abs(shape.x2 - shape.x1),
      height: Math.abs(shape.y2 - shape.y1),
    };
  }
  const left = Math.min(shape.x, shape.x + shape.w);
  const top = Math.min(shape.y, shape.y + shape.h);
  const right = Math.max(shape.x, shape.x + shape.w);
  const bottom = Math.max(shape.y, shape.y + shape.h);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function getShapeCenter(shape) {
  const bounds = getShapeBounds(shape);
  if (!bounds) return { x: 0, y: 0 };
  return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
}

export function getShapeHandles(shape) {
  const bounds = getShapeBounds(shape);
  if (!bounds) return [];
  if (shape.type === "line") {
    return [
      { id: "start", x: shape.x1, y: shape.y1 },
      { id: "end", x: shape.x2, y: shape.y2 },
    ];
  }
  const { left, top, right, bottom } = bounds;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  return [
    { id: "nw", x: left, y: top },
    { id: "n", x: centerX, y: top },
    { id: "ne", x: right, y: top },
    { id: "e", x: right, y: centerY },
    { id: "se", x: right, y: bottom },
    { id: "s", x: centerX, y: bottom },
    { id: "sw", x: left, y: bottom },
    { id: "w", x: left, y: centerY },
  ];
}

export function getResizeCursor(handle) {
  const map = {
    nw: "nwse-resize",
    se: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    start: "move",
    end: "move",
  };
  return map[handle] || "move";
}

export function applyRectResize(shape, handle, startShape, dx, dy) {
  let left = startShape.x;
  let right = startShape.x + startShape.w;
  let top = startShape.y;
  let bottom = startShape.y + startShape.h;

  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;

  shape.x = Math.min(left, right);
  shape.y = Math.min(top, bottom);
  shape.w = Math.max(1, Math.abs(right - left));
  shape.h = Math.max(1, Math.abs(bottom - top));
}

export function applyLineHandle(shape, handle, startShape, dx, dy) {
  if (handle === "start") {
    shape.x1 = startShape.x1 + dx;
    shape.y1 = startShape.y1 + dy;
    return;
  }
  shape.x2 = startShape.x2 + dx;
  shape.y2 = startShape.y2 + dy;
}

export function drawShape(ctx, s) {
  ctx.beginPath();
  if (s.type === "rect") ctx.rect(s.x, s.y, s.w, s.h);
  else if (s.type === "ellipse") {
    const rx = Math.abs(s.w / 2), ry = Math.abs(s.h / 2);
    if (rx > 0 && ry > 0) ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, rx, ry, 0, 0, Math.PI * 2);
  } else if (s.type === "line") { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
  if (s.fill && s.type !== "line") { ctx.fillStyle = s.fill; ctx.fill(); }
  if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 2; ctx.lineCap = "round"; ctx.stroke(); }
}

export function hitShape(s, px, py) {
  if (s.type === "rect") return px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h;
  if (s.type === "ellipse") {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const rx = Math.abs(s.w / 2), ry = Math.abs(s.h / 2);
    return rx > 0 && ry > 0 && ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2) <= 1;
  }
  if (s.type === "line") {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) return dist(px, py, s.x1, s.y1) < 6;
    const t = clamp(((px - s.x1) * dx + (py - s.y1) * dy) / l2, 0, 1);
    return dist(px, py, s.x1 + t * dx, s.y1 + t * dy) < 6;
  }
  return false;
}
