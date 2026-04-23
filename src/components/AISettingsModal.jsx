import { useState } from "react";
import { getApiConfig, setApiConfig, clearApiConfig } from "../ai/storage.js";
import { listProviders, DEFAULT_PROVIDER_ID } from "../ai/providers/index.js";

export default function AISettingsModal({ onClose, onSaved }) {
  const initial = getApiConfig();
  const [anthropicKey, setAnthropicKey] = useState(initial.anthropicKey || "");
  const [providerId, setProviderId] = useState(initial.providerId || DEFAULT_PROVIDER_ID);
  const [providerKey, setProviderKey] = useState(initial.providerKey || "");

  const save = () => {
    setApiConfig({
      anthropicKey: anthropicKey.trim(),
      providerId,
      providerKey: providerKey.trim(),
    });
    onSaved?.();
    onClose?.();
  };

  const clear = () => {
    clearApiConfig();
    setAnthropicKey("");
    setProviderKey("");
    onSaved?.();
  };

  return (
    <div className="pf-modal-backdrop" role="dialog" aria-modal="true" aria-label="AI settings">
      <div className="pf-modal" style={{ maxWidth: 440 }}>
        <div className="pf-modal-head">
          <div className="pf-modal-title">AI Settings</div>
          <button className="pf-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="pf-modal-body">
          <p className="pf-field-help">
            Keys are stored in this browser only, never uploaded or saved into project files.
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
