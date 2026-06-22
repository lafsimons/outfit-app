import DismissibleBackdrop from "./DismissibleBackdrop";

import {
  createFitpicSpreadExportOptions,
  fitpicSpreadExportPresets
} from "../lib/fitpicSpreadExport";

const presetLabels = {
  compact: {
    title: "Compact",
    description: "Primary image and title."
  },
  reference: {
    title: "Reference",
    description: "Primary image, title, and detail grid."
  },
  detailsOnly: {
    title: "Details Only",
    description: "Detail images only, with metadata."
  },
  detailed: {
    title: "Detailed",
    description: "Reference layout with tags and fit date."
  }
};

export default function FitpicExportDialog({
  open,
  options,
  onChange,
  onCancel,
  onConfirm
}) {
  if (!open) {
    return null;
  }

  function applyPreset(preset) {
    onChange(createFitpicSpreadExportOptions(preset));
  }

  function updateOption(key, value) {
    onChange({
      ...options,
      [key]: value
    });
  }

  return (
    <DismissibleBackdrop className="floating-backdrop confirm-backdrop" onDismiss={onCancel}>
      <div
        className="confirm-dialog wardrobe-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fitpic-export-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <p className="eyebrow">Export</p>
          <h2 id="fitpic-export-dialog-title">Fitpics spread options</h2>
        </div>

        <div className="wardrobe-export-presets">
          {Object.keys(fitpicSpreadExportPresets).map((preset) => {
            const presetOptions = createFitpicSpreadExportOptions(preset);
            const isActive = JSON.stringify(options) === JSON.stringify(presetOptions);

            return (
              <button
                key={preset}
                type="button"
                className={`wardrobe-export-preset ${isActive ? "is-active" : ""}`}
                onClick={() => applyPreset(preset)}
              >
                <strong>{presetLabels[preset].title}</strong>
                <span>{presetLabels[preset].description}</span>
              </button>
            );
          })}
        </div>

        <div className="wardrobe-export-section">
          <p className="eyebrow">Scope</p>
          <label className="wardrobe-export-field">
            <span>Export set</span>
            <select value={options.scope} onChange={(event) => updateOption("scope", event.target.value)}>
              <option value="current">Current filtered result set</option>
              <option value="all">All fitpics</option>
            </select>
          </label>
        </div>

        <div className="wardrobe-export-section">
          <p className="eyebrow">Layout</p>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.useCurrentSortOrder}
              onChange={(event) =>
                onChange({
                  ...options,
                  useCurrentSortOrder: event.target.checked,
                  shuffleFitpics: !event.target.checked && options.shuffleFitpics
                })
              }
            />
            <span>Use current sort order</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.shuffleFitpics}
              onChange={(event) =>
                onChange({
                  ...options,
                  shuffleFitpics: event.target.checked,
                  useCurrentSortOrder: !event.target.checked
                })
              }
            />
            <span>Shuffle fitpics</span>
          </label>
        </div>

        <div className="wardrobe-export-section">
          <p className="eyebrow">Labels</p>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.showTitle}
              onChange={(event) => updateOption("showTitle", event.target.checked)}
            />
            <span>Show title</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.showTags}
              onChange={(event) => updateOption("showTags", event.target.checked)}
            />
            <span>Show tags</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.showFitDate}
              onChange={(event) => updateOption("showFitDate", event.target.checked)}
            />
            <span>Show fit date</span>
          </label>
        </div>

        <div className="confirm-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            Export PNG
          </button>
        </div>
      </div>
    </DismissibleBackdrop>
  );
}
