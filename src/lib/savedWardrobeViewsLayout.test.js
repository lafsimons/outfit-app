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

test("generation controls offer compact collection and status multi-select dropdowns", () => {
  assert.match(appSource, /aria-label="Saved wardrobe view for outfit filters"/);
  assert.match(appSource, /<FilterMultiSelect\s+label="Collections"/);
  assert.match(appSource, /<FilterMultiSelect\s+label="Status"/);
  assert.match(appSource, /onToggle=\{toggleGenerationListWithMode\}/);
  assert.doesNotMatch(appSource, /outfitFiltersAdvancedOpen|outfitFilterSectionsOpen/);
});

test("controls panel uses compact generation rows and icon utilities instead of stacked action buttons", () => {
  assert.match(appSource, /aria-label="Generation settings"/);
  assert.doesNotMatch(appSource, /generationSettingsOpen|outfitFiltersOpen/);
  assert.match(appSource, /className=\{`controls-setting-row \$\{layering \? "is-active" : ""\}`\}/);
  assert.match(appSource, /<span>Layering<\/span>[\s\S]*<span>\{layering \? "On" : "Off"\}<\/span>/);
  assert.match(appSource, /<span>Accessories<\/span>[\s\S]*<span>\{accessoriesEnabled \? "On" : "Off"\}<\/span>/);
  assert.match(appSource, /<span>Mode<\/span>[\s\S]*generationMode === "guided" \? "Guided" : "Random"/);
  assert.match(appSource, /className="controls-actions-row" aria-label="Outfit actions"/);
  assert.match(appSource, /className=\{`controls-action-icon \$\{isCurrentOutfitLiked \? "is-active" : ""\}`\}/);
  assert.match(appSource, /<SlotActionIcon kind="favorite" active=\{isCurrentOutfitLiked\} \/>/);
  assert.match(appSource, /<SlotActionIcon kind="save" active=\{isCurrentOutfitSaved\} \/>/);
  assert.match(appSource, /<SlotActionIcon kind="export" \/>/);
  assert.match(appSource, /aria-label="Export outfit image"/);
  assert.match(appSource, /hasLockedOutfitSlots \? \(/);
  assert.doesNotMatch(appSource, /controls-section-heading">Actions/);
  assert.match(stylesSource, /\.controls-generation-settings-heading\s*\{/);
  assert.match(stylesSource, /\.controls-setting-row\s*\{/);
  assert.match(stylesSource, /\.controls-actions-row\s*\{/);
  assert.match(stylesSource, /\.controls-action-icon\s*\{/);
});

test("controls panel keeps weather and debug behind an advanced row", () => {
  assert.match(appSource, /aria-label="Advanced controls"/);
  assert.match(appSource, /className=\{`controls-advanced-toggle \$\{controlsAdvancedOpen \? "is-active" : ""\}`\}/);
  assert.match(appSource, /className=\{`ghost-button controls-advanced-action \$\{outfitDebugOpen \? "is-active" : ""\}`\}/);
  assert.match(appSource, /showDebugPopout \? renderOutfitDebugPanel\("outfit-debug-popout"\) : null/);
  assert.doesNotMatch(appSource, /controls-group-generate-count/);
  assert.match(stylesSource, /\.controls-advanced-toggle\s*\{/);
  assert.match(stylesSource, /\.controls-advanced-actions-row\s*\{/);
});

test("saved wardrobe views survive backup load and backup export app-state wiring", () => {
  assert.match(appSource, /setSavedWardrobeViews\(hydratedAppState\.savedWardrobeViews\);/);
  assert.match(appSource, /savedWardrobeViews,\s*windowState/);
});
