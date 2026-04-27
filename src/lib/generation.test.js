import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNextOutfit,
  getOutfitDominantStyle,
  rememberRecentOutfit
} from "./generation.js";

const syntheticWardrobe = [
  { id: "head_cap", type: "Cap", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Casual"] },
  { id: "head_sport_cap", type: "Sport Cap", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Athleisure"] },
  { id: "head_hat", type: "Hat", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  { id: "top_tee", type: "T-Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Casual"] },
  { id: "top_shirt", type: "Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  { id: "top_knit", type: "Knit Sweater", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  { id: "top_sport_ls", type: "Sport LS T-Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Athleisure"] },
  { id: "top_hoodie", type: "Hoodie", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "outer_jacket", type: "Jacket", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual"] },
  { id: "outer_blazer", type: "Blazer", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "outer_shell", type: "Shell Jacket", garmentType: "Outerwear", layerType: "Outer", weight: "Light", styleTags: ["Athleisure"] },
  { id: "outer_wool", type: "Wool Coat", garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Formal", "Smart Casual"] },
  { id: "bottom_jeans", type: "Jeans", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Casual"] },
  { id: "bottom_trousers", type: "Trousers", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "bottom_shorts", type: "Shorts", garmentType: "Bottom", layerType: "Both", weight: "Light", styleTags: ["Casual"] },
  { id: "bottom_sport_shorts", type: "Sport Shorts", garmentType: "Bottom", layerType: "Both", weight: "Light", styleTags: ["Athleisure"] },
  { id: "shoe_sneakers", type: "Sneakers", garmentType: "Footwear", layerType: "Both", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  { id: "shoe_leather", type: "Leather Sneakers", garmentType: "Footwear", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  { id: "shoe_derby", type: "Derby", garmentType: "Footwear", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "shoe_boots", type: "Boots", garmentType: "Footwear", layerType: "Both", weight: "Heavy", styleTags: ["Casual", "Smart Casual"] }
];

const itemsById = Object.fromEntries(syntheticWardrobe.map((item) => [item.id, item]));

function withSeed(seed, run) {
  const originalRandom = Math.random;
  let state = seed >>> 0;

  Math.random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

function generateBatch({
  count = 60,
  outfitFilters = { style: [], climate: [] },
  seed = 42
} = {}) {
  return withSeed(seed, () => {
    const results = [];
    let recentOutfits = [];

    for (let index = 0; index < count; index += 1) {
      const outfit = buildNextOutfit(
        syntheticWardrobe,
        {},
        {},
        true,
        {},
        { Wardrobe: true, Wishlist: true },
        outfitFilters,
        null,
        "guided",
        {},
        recentOutfits
      );
      results.push(outfit);
      recentOutfits = rememberRecentOutfit(recentOutfits, outfit, true, { preserveLiked: true });
    }

    return results;
  });
}

function countByDominantStyle(outfits) {
  return outfits.reduce((counts, outfit) => {
    const style = getOutfitDominantStyle(outfit, itemsById);
    counts[style] = (counts[style] ?? 0) + 1;
    return counts;
  }, {});
}

function hasHeavyOuterwear(outfit) {
  const item = itemsById[outfit.TopOuter];
  return item?.garmentType === "Outerwear" && item.weight === "Heavy";
}

function hasBoots(outfit) {
  return itemsById[outfit.Footwear]?.type === "Boots";
}

function isLightOrSportTop(outfit) {
  const item = itemsById[outfit.TopInner];
  return Boolean(item) && (
    ["T-Shirt", "Sport LS T-Shirt"].includes(item.type) ||
    (item.weight === "Light" && item.type === "Sport LS T-Shirt")
  );
}

test("no-filter generation uses weighted variety instead of collapsing into casual", () => {
  const outfits = generateBatch();
  const counts = countByDominantStyle(outfits);
  const representedStyles = Object.values(counts).filter((count) => count > 0).length;

  assert.ok((counts.Casual ?? 0) > (counts["Smart Casual"] ?? 0));
  assert.ok((counts["Smart Casual"] ?? 0) >= 10);
  assert.ok((counts.Athleisure ?? 0) >= 8);
  assert.ok((counts.Casual ?? 0) <= 32);
  assert.ok((counts.Formal ?? 0) <= 12);
  assert.ok(representedStyles >= 3);
});

test("sport cap only appears in athleisure-leaning no-filter outfits", () => {
  const outfits = generateBatch({ count: 80, seed: 99 });

  outfits.forEach((outfit) => {
    if (outfit.Headwear !== "head_sport_cap") return;
    assert.equal(getOutfitDominantStyle(outfit, itemsById), "Athleisure");
  });
});

test("cold generation avoids light or sport tops with boots or heavy outerwear", () => {
  const outfits = generateBatch({ count: 50, outfitFilters: { style: [], climate: ["Cold"] }, seed: 7 });

  outfits.forEach((outfit) => {
    if (!hasHeavyOuterwear(outfit) && !hasBoots(outfit)) return;
    assert.equal(isLightOrSportTop(outfit), false);
  });
});

test("smart shirt with shorts and medium or heavy outerwear is suppressed", () => {
  const outfits = generateBatch({ count: 80, outfitFilters: { style: [], climate: ["Warm"] }, seed: 123 });

  outfits.forEach((outfit) => {
    const top = itemsById[outfit.TopInner];
    const bottom = itemsById[outfit.Bottom];
    const outer = itemsById[outfit.TopOuter];
    const hasSmartShirt = top?.type === "Shirt";
    const hasShorts = bottom?.type === "Shorts";
    const hasMediumOrHeavyOuterwear = outer?.garmentType === "Outerwear" && ["Medium", "Heavy"].includes(outer.weight);

    assert.equal(hasSmartShirt && hasShorts && hasMediumOrHeavyOuterwear, false);
  });
});

test("session correction avoids 3-item and 3-style streaks with ample wardrobe support", () => {
  const outfits = generateBatch({ count: 40, seed: 2026 });
  let styleStreak = 1;
  let topInnerStreak = 1;
  let threeStyleStreaks = 0;

  for (let index = 1; index < outfits.length; index += 1) {
    const previousStyle = getOutfitDominantStyle(outfits[index - 1], itemsById);
    const currentStyle = getOutfitDominantStyle(outfits[index], itemsById);
    styleStreak = previousStyle === currentStyle ? styleStreak + 1 : 1;
    if (styleStreak === 3) threeStyleStreaks += 1;
    assert.ok(styleStreak < 4);

    const previousTop = outfits[index - 1].TopInner;
    const currentTop = outfits[index].TopInner;
    topInnerStreak = previousTop === currentTop ? topInnerStreak + 1 : 1;
    assert.ok(topInnerStreak < 3);
  }

  assert.ok(threeStyleStreaks <= 1);
});
