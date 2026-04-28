function matches(data, index, target, tolerance) {
  return Math.abs(data[index] - target[0]) <= tolerance
    && Math.abs(data[index + 1] - target[1]) <= tolerance
    && Math.abs(data[index + 2] - target[2]) <= tolerance
    && Math.abs(data[index + 3] - target[3]) <= tolerance;
}

function sameColor(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

export function floodFill(imageData, startX, startY, fillRgba, tolerance = 0) {
  const { width, height } = imageData;
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return imageData;

  const next = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
  const { data } = next;
  const startIndex = (y0 * width + x0) * 4;
  const target = [data[startIndex], data[startIndex + 1], data[startIndex + 2], data[startIndex + 3]];
  const fill = [
    Math.max(0, Math.min(255, fillRgba[0])),
    Math.max(0, Math.min(255, fillRgba[1])),
    Math.max(0, Math.min(255, fillRgba[2])),
    Math.max(0, Math.min(255, fillRgba[3] ?? 255)),
  ];
  const tol = Math.max(0, Math.min(255, tolerance));
  if (sameColor(target, fill)) return next;

  const stack = [[x0, y0]];
  while (stack.length) {
    const [seedX, seedY] = stack.pop();
    let left = seedX;
    let index = (seedY * width + left) * 4;
    while (left >= 0 && matches(data, index, target, tol)) {
      left -= 1;
      index -= 4;
    }
    left += 1;

    let right = seedX;
    index = (seedY * width + right) * 4;
    while (right < width && matches(data, index, target, tol)) {
      right += 1;
      index += 4;
    }
    right -= 1;

    for (let x = left; x <= right; x += 1) {
      const fillIndex = (seedY * width + x) * 4;
      data[fillIndex] = fill[0];
      data[fillIndex + 1] = fill[1];
      data[fillIndex + 2] = fill[2];
      data[fillIndex + 3] = fill[3];

      if (seedY > 0) {
        const upIndex = ((seedY - 1) * width + x) * 4;
        if (matches(data, upIndex, target, tol)) stack.push([x, seedY - 1]);
      }
      if (seedY < height - 1) {
        const downIndex = ((seedY + 1) * width + x) * 4;
        if (matches(data, downIndex, target, tol)) stack.push([x, seedY + 1]);
      }
    }
  }

  return next;
}
