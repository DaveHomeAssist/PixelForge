export function imageDataToFile(imageData, filename = "PixelForge Selection.png") {
  return new Promise((resolve) => {
    const tmp = document.createElement("canvas");
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext("2d").putImageData(imageData, 0, 0);
    tmp.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new File([blob], filename, { type: "image/png" }));
    }, "image/png");
  });
}

export function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

export function readSelectionImageData(layer, selectionMask) {
  if (!selectionMask || !layer?.canvas) return null;
  if (selectionMask.floating?.imageData) return cloneImageData(selectionMask.floating.imageData);
  return layer.canvas.getContext("2d").getImageData(
    selectionMask.rect.x,
    selectionMask.rect.y,
    selectionMask.rect.w,
    selectionMask.rect.h,
  );
}
