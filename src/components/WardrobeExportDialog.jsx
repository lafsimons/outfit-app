import {
  createWardrobeSpreadExportOptions,
  wardrobeSpreadExportPresets
} from "../lib/wardrobeSpreadExport";

const presetLabels = {
  compact: {
    title: "Compact",
    description: "Image only, shuffled layout."
  },
  reference: {
    title: "Reference",
    description: "Current sort order with item names."
  },
  detailed: {
    title: "Detailed",
    description: "Current sort order with name and brand."
  }
};

export default function WardrobeExportDialog({
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
    onChange(createWardrobeSpreadExportOptions(preset));
  }

  function updateOption(key, value) {
    onChange({
      ...options,
      [key]: value
    });
  }

  return (
    <div className="floating-backdrop confirm-backdrop" onClick={onCancel}>
      <div
        className="confirm-dialog wardrobe-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wardrobe-export-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <p className="eyebrow">Export</p>
          <h2 id="wardrobe-export-dialog-title">Wardrobe spread options</h2>
        </div>

        <div className="wardrobe-export-presets">
          {Object.keys(wardrobeSpreadExportPresets).map((preset) => {
            const presetOptions = createWardrobeSpreadExportOptions(preset);
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
          <p className="eyebrow">Layout</p>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.shuffleItems}
              onChange={(event) =>
                onChange({
                  ...options,
                  shuffleItems: event.target.checked,
                  useCurrentSortOrder: !event.target.checked
                })
              }
            />
            <span>Shuffle items</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.useCurrentSortOrder}
              onChange={(event) =>
                onChange({
                  ...options,
                  useCurrentSortOrder: event.target.checked,
                  shuffleItems: !event.target.checked
                })
              }
            />
            <span>Use current sort order</span>
          </label>
        </div>

        <div className="wardrobe-export-section">
          <p className="eyebrow">Labels</p>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.showItemName}
              onChange={(event) => updateOption("showItemName", event.target.checked)}
            />
            <span>Show item name</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.showBrand}
              onChange={(event) => updateOption("showBrand", event.target.checked)}
            />
            <span>Show brand</span>
          </label>
          <label className="controls-generation-list-option">
            <input
              type="checkbox"
              checked={options.showId}
              onChange={(event) => updateOption("showId", event.target.checked)}
            />
            <span>Show ID</span>
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
    </div>
  );
}
