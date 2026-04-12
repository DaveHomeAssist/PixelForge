import { useCallback, useEffect, useRef, useState } from "react";
import { AUTOSAVE_KEY, AUTOSAVE_MAX_AGE_MS } from "../constants.js";
import { writeAutosave, readAutosave, deleteAutosave } from "../autosave.js";
import { buildDraftPayload } from "../serialization.js";

export default function useAutosaveRecovery({
  isDirty,
  docVersion,
  docW,
  docH,
  activeId,
  selectedShape,
  docRef,
  flash,
}) {
  const [recoveryDraft, setRecoveryDraft] = useState(null);
  const autosaveTimer = useRef(null);

  const clearStoredDraft = useCallback(() => {
    window.clearTimeout(autosaveTimer.current);
    return deleteAutosave(AUTOSAVE_KEY).catch(() => {});
  }, []);

  const clearRecoveryDraft = useCallback(() => {
    setRecoveryDraft(null);
    return clearStoredDraft();
  }, [clearStoredDraft]);

  useEffect(() => () => window.clearTimeout(autosaveTimer.current), []);

  useEffect(() => {
    readAutosave(AUTOSAVE_KEY)
      .then(data => {
        if (data?.savedAt && Date.now() - data.savedAt > AUTOSAVE_MAX_AGE_MS) {
          clearStoredDraft();
          return;
        }
        if (data?.project?.layers?.length) {
          setRecoveryDraft(data);
        }
      })
      .catch(() => {
        clearStoredDraft();
      });
  }, [clearStoredDraft]);

  useEffect(() => {
    if (!isDirty) return;
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      buildDraftPayload(docRef.current, docW, docH, activeId, selectedShape)
        .then(project => writeAutosave(AUTOSAVE_KEY, { savedAt: Date.now(), project }))
        .catch(() => flash("Autosave failed — draft may not be recoverable.", "error", 3000));
    }, 900);
    return () => window.clearTimeout(autosaveTimer.current);
  }, [activeId, docH, docVersion, docRef, docW, flash, isDirty, selectedShape]);

  return {
    recoveryDraft,
    setRecoveryDraft,
    clearStoredDraft,
    clearRecoveryDraft,
  };
}
