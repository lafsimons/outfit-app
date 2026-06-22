import DismissibleBackdrop from "./DismissibleBackdrop";

export default function OaAiExportDialog({
  open,
  options,
  collections,
  statuses,
  exporting = false,
  onChange,
  onCancel,
  onConfirm
}) {
  if (!open) {
    return null;
  }

  function updateOption(key, value) {
    onChange({
      ...options,
      [key]: value
    });
  }

  function toggleSelection(key, collection) {
    const selectedValues = Array.isArray(options[key]) ? options[key] : [];
    const isSelected = selectedValues.includes(collection);

    updateOption(
      key,
      isSelected
        ? selectedValues.filter((value) => value !== collection)
        : [...selectedValues, collection]
    );
  }

  return (
    <DismissibleBackdrop className="floating-backdrop confirm-backdrop" onDismiss={exporting ? undefined : onCancel}>
      <div
        className="confirm-dialog wardrobe-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oa-ai-export-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <p className="eyebrow">Export</p>
          <h2 id="oa-ai-export-dialog-title">OA AI export bundle</h2>
        </div>

        <div className="wardrobe-export-section">
          <p className="eyebrow">Core Datasets</p>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.includeCurrentWardrobe}
              onChange={(event) => updateOption("includeCurrentWardrobe", event.target.checked)}
            />
            <span>Current Wardrobe</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.includeAcquisitionPipeline}
              onChange={(event) => updateOption("includeAcquisitionPipeline", event.target.checked)}
            />
            <span>Acquisition Pipeline</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.includeFitpics}
              onChange={(event) => updateOption("includeFitpics", event.target.checked)}
            />
            <span>Fitpics</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.includeSavedOutfits}
              onChange={(event) => updateOption("includeSavedOutfits", event.target.checked)}
            />
            <span>Saved Outfits</span>
          </label>
        </div>

        <div className="wardrobe-export-section">
          <p className="eyebrow">Current Wardrobe Options</p>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.excludeCollectionsFromCurrentWardrobe}
              onChange={(event) => updateOption("excludeCollectionsFromCurrentWardrobe", event.target.checked)}
            />
            <span>Exclude selected collections</span>
          </label>
          {collections.length ? (
            <div className="oa-ai-export-list">
              <p className="oa-ai-export-list-title">Excluded collections</p>
              {collections.map((collection) => (
                <label key={collection} className="controls-generation-list-option">
                  <input
                    type="checkbox"
                    checked={(options.excludedCollections ?? []).includes(collection)}
                    disabled={!options.excludeCollectionsFromCurrentWardrobe}
                    onChange={() => toggleSelection("excludedCollections", collection)}
                  />
                  <span>{collection}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="oa-ai-export-empty">No collections available.</p>
          )}
        </div>

        <div className="wardrobe-export-section">
          <p className="eyebrow">Collection Exports</p>
          {collections.length ? (
            <div className="oa-ai-export-list">
              {collections.map((collection) => (
                <label key={collection} className="controls-generation-list-option">
                  <input
                    type="checkbox"
                    checked={(options.collectionExports ?? []).includes(collection)}
                    onChange={() => toggleSelection("collectionExports", collection)}
                  />
                  <span>{collection}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="oa-ai-export-empty">No collections available.</p>
          )}
        </div>

        <div className="wardrobe-export-section">
          <p className="eyebrow">Status Exports</p>
          {statuses.length ? (
            <>
              <label className="controls-generation-list-option">
                <input
                  type="radio"
                  name="oa-ai-status-export-mode"
                  checked={options.statusExportMode !== "separate"}
                  onChange={() => updateOption("statusExportMode", "combined")}
                />
                <span>One combined status export</span>
              </label>
              <label className="controls-generation-list-option">
                <input
                  type="radio"
                  name="oa-ai-status-export-mode"
                  checked={options.statusExportMode === "separate"}
                  onChange={() => updateOption("statusExportMode", "separate")}
                />
                <span>Separate export per status</span>
              </label>
              <div className="oa-ai-export-list">
                {statuses.map((status) => (
                  <label key={status} className="controls-generation-list-option">
                    <input
                      type="checkbox"
                      checked={(options.statusExports ?? []).includes(status)}
                      onChange={() => toggleSelection("statusExports", status)}
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className="oa-ai-export-empty">No statuses available.</p>
          )}
        </div>

        <div className="confirm-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={exporting}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={exporting}>
            {exporting ? "Exporting..." : "Export OA AI"}
          </button>
        </div>
      </div>
    </DismissibleBackdrop>
  );
}
