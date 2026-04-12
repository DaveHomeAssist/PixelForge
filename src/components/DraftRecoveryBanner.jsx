export default function DraftRecoveryBanner({
  recoveryDraft,
  feedbackClass,
  recoverDraftProject,
  discardRecoveredDraft,
}) {
  if (!recoveryDraft) return null;

  return (
    <div className="pf-draft-banner">
      <strong>Autosaved draft available</strong>
      <p>
        A browser draft from {recoveryDraft.savedAt ? new Date(recoveryDraft.savedAt).toLocaleString() : "an earlier session"} is available to recover.
      </p>
      <div className="pf-draft-actions">
        <button className={`pf-mbtn primary ${feedbackClass("recover")}`} onClick={recoverDraftProject}>Recover Draft</button>
        <button className="pf-mbtn" onClick={discardRecoveredDraft}>Discard</button>
      </div>
    </div>
  );
}
