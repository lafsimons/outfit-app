import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.jsx", import.meta.url),
  "utf8"
);

const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8"
);

test("generation controls prioritize saved wardrobe views and tuck advanced filters behind a compact hierarchy", () => {
  assert.match(appSource, /function applyOutfitFiltersSavedWardrobeView/);
  assert.match(appSource, /matchesCurrentOutfitFiltersSavedWardrobeView/);
  assert.match(appSource, /aria-label="Saved wardrobe view for outfit filters"/);
  assert.match(appSource, /matchingOutfitFiltersSavedWardrobeViewId \|\| "__custom__"/);
  assert.match(appSource, /outfitFiltersAdvancedOpen \? "Hide Filters" : "More Filters"/);
  assert.match(appSource, /key: "status"[\s\S]*label: "Status"/);
  assert.match(appSource, /toggleGenerationListWithMode\(list, event\.shiftKey\)/);
  assert.doesNotMatch(appSource, /aria-label="Generation lists"/);
  assert.doesNotMatch(appSource, /handleRenameSavedWardrobeView[\s\S]{0,1200}Saved wardrobe view for outfit filters/);
  assert.doesNotMatch(appSource, /handleDeleteSavedWardrobeView[\s\S]{0,1200}Saved wardrobe view for outfit filters/);
  assert.match(stylesSource, /\.outfit-filter-view-row\s*\{/);
  assert.match(stylesSource, /\.outfit-filters-advanced-toggle\s*\{/);
  assert.match(stylesSource, /\.outfit-filter-section-toggle\s*\{/);
});

test("controls panel uses compact generation rows and icon utilities instead of stacked action buttons", () => {
  assert.match(appSource, /aria-label="Generation settings"/);
  assert.match(appSource, /generationSettingsOpen \? "is-active" : ""/);
  assert.match(appSource, /className=\{`controls-setting-row \$\{layering \? "is-active" : ""\}`\}/);
  assert.match(appSource, /<span>Layering<\/span>[\s\S]*<span>\{layering \? "On" : "Off"\}<\/span>/);
  assert.match(appSource, /<span>Accessories<\/span>[\s\S]*<span>\{accessoriesEnabled \? "On" : "Off"\}<\/span>/);
  assert.match(appSource, /<span>Mode<\/span>[\s\S]*generationMode === "guided" \? "Guided" : "Random"/);
  assert.match(appSource, /<div className="controls-section-heading">Actions<\/div>/);
  assert.match(appSource, /className="controls-actions-row" aria-label="Outfit actions"/);
  assert.match(appSource, /className=\{`ghost-button slot-action-icon-button controls-action-icon \$\{isCurrentOutfitLiked \? "is-active" : ""\}`\}/);
  assert.match(appSource, /<SlotActionIcon kind="favorite" \/>/);
  assert.match(appSource, /<SlotActionIcon kind="save" \/>/);
  assert.match(appSource, /<SlotActionIcon kind="export" \/>/);
  assert.match(appSource, /aria-label="Export outfit image"/);
  assert.match(stylesSource, /\.controls-generation-settings-toggle\s*\{/);
  assert.match(stylesSource, /\.controls-setting-row\s*\{/);
  assert.match(stylesSource, /\.controls-actions-row\s*\{/);
  assert.match(stylesSource, /\.controls-action-icon\s*\{/);
});
