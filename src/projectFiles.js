export function supportsFileSave() {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

export async function saveProjectPayload(payload, currentHandle, suggestedName = "project.pforge") {
  if (supportsFileSave()) {
    const handle = currentHandle || await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "PixelForge Project",
          accept: {
            "application/json": [".pforge"],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(payload));
    await writable.close();
    return { mode: "file", handle };
  }

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return { mode: "download", handle: null };
}
