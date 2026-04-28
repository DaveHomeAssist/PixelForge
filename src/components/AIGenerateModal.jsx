import { useEffect, useRef, useState } from "react";
import { hasAnthropicKey, hasProviderKey } from "../ai/storage.js";

export default function AIGenerateModal({
  onClose,
  onResult,
  onOpenSettings,
}) {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Abort any in-flight request on unmount (e.g., when the modal is closed).
  useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

  const run = async () => {
    setError(null);
    if (!hasAnthropicKey() || !hasProviderKey()) {
      setError("Set your API keys to continue.");
      onOpenSettings?.();
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) { setError("Enter a prompt."); return; }
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { generateLayer } = await import("../ai/index.js");
      const { blob } = await generateLayer(trimmed, {
        aspect,
        signal: controller.signal,
      });
      onResult?.(blob, trimmed);
      onClose?.();
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Cancelled.");
      } else {
        setError(err.message || "Generation failed.");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    if (abortRef.current) abortRef.current.abort();
  };

  return (
    <div className="pf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Generate with AI">
      <div className="pf-modal" style={{ maxWidth: 480 }}>
        <div className="pf-modal-head">
          <div className="pf-modal-title">✨ Generate with AI</div>
          <button className="pf-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="pf-modal-body">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the image you want…"
            rows={4}
            aria-label="Prompt"
            style={{ width: "100%", padding: 8 }}
            disabled={busy}
          />
          <div className="pf-prop-row" style={{ marginTop: 10 }}>
            <span className="pf-prop-label">Aspect</span>
            <div className="pf-prop-val">
              {["1:1", "3:2", "2:3", "16:9"].map(a => (
                <button
                  key={a}
                  type="button"
                  className={`pf-chip-btn ${aspect === a ? "active" : ""}`}
                  onClick={() => setAspect(a)}
                  disabled={busy}
                  style={{ marginRight: 4 }}
                  aria-pressed={aspect === a}
                >{a}</button>
              ))}
            </div>
          </div>
          {error && <div className="pf-field-help warn" role="alert">{error}</div>}
          {busy && <div className="pf-field-help">Generating… this can take 10–60 seconds.</div>}
          <div className="pf-modal-actions" style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="pf-chip-btn" onClick={onOpenSettings} disabled={busy}>Settings</button>
            {busy ? (
              <button type="button" className="pf-chip-btn" onClick={cancel}>Cancel</button>
            ) : (
              <>
                <button type="button" className="pf-chip-btn" onClick={onClose}>Close</button>
                <button type="button" className="pf-chip-btn active" onClick={run}>Generate</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
