import { useCallback, useEffect, useRef, useState } from "react";
import { applyImageEffectAsync } from "../imageEffects.js";

export const ADJUSTMENT_CONFIGS = {
  brightness: { title: "Brightness", min: -255, max: 255, step: 1, defaultAmount: 0 },
  contrast: { title: "Contrast", min: -100, max: 100, step: 1, defaultAmount: 0 },
  hue: { title: "Hue", min: -180, max: 180, step: 1, defaultAmount: 0 },
  saturation: { title: "Saturation", min: -100, max: 100, step: 1, defaultAmount: 0 },
  lightness: { title: "Lightness", min: -100, max: 100, step: 1, defaultAmount: 0 },
  threshold: { title: "Threshold", min: 0, max: 255, step: 1, defaultAmount: 128 },
  posterize: { title: "Posterize", min: 2, max: 16, step: 1, defaultAmount: 4 },
  gaussianBlur: { title: "Gaussian Blur", min: 0, max: 8, step: 1, defaultAmount: 1 },
  motionBlur: { title: "Motion Blur", min: 1, max: 64, step: 1, defaultAmount: 8 },
  noise: { title: "Noise", min: 0, max: 100, step: 1, defaultAmount: 16 },
};

function requestFrame(callback) {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return window.setTimeout(callback, 16);
}

function cancelFrame(id) {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  else window.clearTimeout(id);
}

export default function AdjustModal({
  kind,
  open,
  sourceImageData,
  onCancel,
  onCommit,
}) {
  const config = ADJUSTMENT_CONFIGS[kind] || ADJUSTMENT_CONFIGS.brightness;
  const [amountState, setAmountState] = useState({ kind: null, sourceImageData: null, amount: 0 });
  const amount = open && amountState.kind === kind && amountState.sourceImageData === sourceImageData
    ? amountState.amount
    : config.defaultAmount;
  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const frameRef = useRef(null);
  const abortRef = useRef(null);
  const [committing, setCommitting] = useState(false);

  const renderPreview = useCallback((nextAmount) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    previewRef.current = null;
    if (frameRef.current) cancelFrame(frameRef.current);
    frameRef.current = requestFrame(() => {
      frameRef.current = null;
      if (!open || !sourceImageData || controller.signal.aborted) return;
      applyImageEffectAsync(sourceImageData, kind, nextAmount, { signal: controller.signal })
        .then(nextImageData => {
          if (controller.signal.aborted) return;
          previewRef.current = nextImageData;
          const canvas = canvasRef.current;
          if (!canvas) return;
          if (canvas.width !== sourceImageData.width) canvas.width = sourceImageData.width;
          if (canvas.height !== sourceImageData.height) canvas.height = sourceImageData.height;
          canvas.getContext("2d").putImageData(nextImageData, 0, 0);
        })
        .catch(err => {
          if (err?.name !== "AbortError") previewRef.current = null;
        });
    });
  }, [kind, open, sourceImageData]);

  useEffect(() => {
    if (!open || !sourceImageData) return undefined;
    renderPreview(amount);
    return () => {
      abortRef.current?.abort();
      if (frameRef.current) {
        cancelFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [amount, open, renderPreview, sourceImageData]);

  const commit = () => {
    if (!sourceImageData) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCommitting(true);
    applyImageEffectAsync(sourceImageData, kind, amount, { signal: controller.signal })
      .then(nextImageData => {
        if (!controller.signal.aborted) {
          setCommitting(false);
          onCommit(nextImageData);
        }
      })
      .catch(err => {
        if (err?.name !== "AbortError") setCommitting(false);
      });
  };

  if (!open || !sourceImageData) return null;

  return (
    <div className="pf-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${config.title} adjustment`}>
      <div className="pf-modal" style={{ maxWidth: 480 }}>
        <div className="pf-modal-head">
          <div className="pf-modal-title">{config.title}</div>
        </div>
        <div className="pf-modal-body">
          <canvas
            ref={canvasRef}
            aria-label={`${config.title} preview`}
            style={{ width: "100%", maxHeight: 240, border: "1px solid var(--pf-line)", imageRendering: "pixelated" }}
          />
          <label className="pf-prop-row" style={{ marginTop: 14 }}>
            <span className="pf-prop-label">Amount</span>
            <span className="pf-prop-val">
              <input
                className="pf-slider"
                type="range"
                min={config.min}
                max={config.max}
                step={config.step}
                value={amount}
                onChange={event => setAmountState({ kind, sourceImageData, amount: Number(event.target.value) })}
                aria-label="Amount"
              />
            </span>
            <output aria-label="Amount value">{amount}</output>
          </label>
        </div>
        <div className="pf-modal-actions">
          <button className="pf-mbtn" type="button" onClick={onCancel}>Cancel</button>
          <button className="pf-mbtn primary" type="button" onClick={commit} disabled={committing}>{committing ? "Working" : "OK"}</button>
        </div>
      </div>
    </div>
  );
}
