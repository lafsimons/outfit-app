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

test("generation controls expose saved wardrobe views as apply-only shortcuts", () => {
  assert.match(appSource, /function applyOutfitFiltersSavedWardrobeView/);
  assert.match(appSource, /matchesCurrentOutfitFiltersSavedWardrobeView/);
  assert.match(appSource, /aria-label="Saved wardrobe views for outfit filters"/);
  assert.match(appSource, /className=\{`ghost-button outfit-saved-view-chip \$\{isCurrentView \? "is-current" : ""\}`\}/);
  assert.doesNotMatch(appSource, /Saved wardrobe views for outfit filters[\s\S]{0,1200}handleRenameSavedWardrobeView/);
  assert.doesNotMatch(appSource, /Saved wardrobe views for outfit filters[\s\S]{0,1200}handleDeleteSavedWardrobeView/);
  assert.match(stylesSource, /\.outfit-saved-views-list\s*\{/);
  assert.match(stylesSource, /\.outfit-saved-view-chip\.is-current\s*\{/);
});
