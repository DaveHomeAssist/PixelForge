import { useRef, useState } from "react";
import { getApiConfig, setApiConfig, clearApiConfig } from "../ai/storage.js";
import { listProviders, DEFAULT_PROVIDER_ID } from "../ai/providers/index.js";
import useFocusTrap from "../hooks/useFocusTrap.js";

export default function AISettingsModal({ onClose, onSaved }) {
  const initial = getApiConfig();
  const [anthropicKey, setAnthropicKey] = useState(initial.anthropicKey || "");
  const [providerId, setProviderId] = useState(initial.providerId || DEFAULT_PROVIDER_ID);
  const [providerKey, setProviderKey] = useState(initial.providerKey || "");
  const [providerProxyUrl, setProviderProxyUrl] = useState(initial.providerProxyUrl || "");
  const containerRef = useRef(null);

  // Mounted only while open (parent gates render); trap is active for the
  // full lifetime of this component.
  useFocusTrap(true, containerRef, { restore: true, autoFocus: true, onEscape: onClose });

  const save = () => {
    setApiConfig({
      anthropicKey: anthropicKey.trim(),
      providerId,
      providerKey: providerKey.trim(),
      providerProxyUrl: providerProxyUrl.trim(),
    });
    onSaved?.();
    onClose?.();
  };

  const clear = () => {
    clearApiConfig();
    setAnthropicKey("");
    setProviderKey("");
    setProviderProxyUrl("");
    onSaved?.();
  };

  return (
    <div className="pf-modal-backdrop" onClick={onClose}>
      <div
        ref={containerRef}
        className="pf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-ai-settings-title"
        style={{ maxWidth: 440 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="pf-modal-head">
          <div className="pf-modal-title" id="pf-ai-settings-title">AI Settings</div>
          <button className="pf-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="pf-modal-body">
          <p className="pf-field-help">
            Keys are stored in this tab's session storage and are cleared when the tab
            closes. They are not included in saved project files.
          </p>

          <div className="pf-prop-row">
            <span className="pf-prop-label">Anthropic key</span>
            <div className="pf-prop-val">
              <input
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                aria-label="Anthropic API key"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div className="pf-prop-row">
            <span className="pf-prop-label">Provider</span>
            <div className="pf-prop-val">
              <select value={providerId} onChange={e => setProviderId(e.target.value)} aria-label="Image provider">
                {listProviders().map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="pf-prop-row">
            <span className="pf-prop-label">Provider key</span>
            <div className="pf-prop-val">
              <input
                type="password"
                value={providerKey}
                onChange={e => setProviderKey(e.target.value)}
                placeholder="r8_..."
                aria-label="Provider API key"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div className="pf-prop-row">
            <span className="pf-prop-label">CORS proxy URL</span>
            <div className="pf-prop-val">
              <input
                type="text"
                value={providerProxyUrl}
                onChange={e => setProviderProxyUrl(e.target.value)}
                placeholder="https://replicate-proxy.example.workers.dev"
                aria-label="Provider CORS proxy URL"
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <p className="pf-field-help">
            Replicate's API blocks direct browser calls (no CORS headers). Requests are sent
            through this proxy, which must forward them to api.replicate.com and add CORS
            headers. Your provider key passes through the proxy, so only use one you run
            yourself.
          </p>

          <div className="pf-modal-actions" style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="pf-chip-btn" onClick={clear}>Clear keys</button>
            <button type="button" className="pf-chip-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="pf-chip-btn active" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
