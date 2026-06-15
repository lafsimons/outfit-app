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
