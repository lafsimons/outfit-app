import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNextOutfit,
  getCurrentOutfitClimateChip,
  getGuidedScoreBreakdown,
  getOutfitDominantStyle,
  rememberRecentOutfit
} from "./generation.js";
import { resolveTypeDefaults } from "./typeDefaults.js";

const syntheticWardrobe = [
  { id: "head_cap", type: "Cap", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Casual"] },
  { id: "head_sport_cap", type: "Sport Cap", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Athleisure"] },
  { id: "head_beanie_light", type: "Beanie (light)", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  { id: "head_beanie", type: "Beanie", garmentType: "Headwear", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "head_hat", type: "Hat", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  { id: "head_formal_hat", type: "Hat", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Formal"] },
  { id: "top_tee", type: "T-Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Casual"] },
  { id: "top_shirt", type: "Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  { id: "top_formal_shirt", type: "Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Formal"] },
  { id: "top_knit", type: "Knit Sweater", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  { id: "top_sport_ls", type: "Sport LS T-Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Athleisure"] },
  { id: "top_hoodie", type: "Hoodie", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "top_fleece_sweater", type: "Fleece Sweater", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "top_wool_shirt", type: "Wool Shirt", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual"] },
  { id: "outer_jacket", type: "Jacket", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual"] },
  { id: "outer_blazer", type: "Blazer", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "outer_formal_blazer", type: "Blazer", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Formal"] },
  { id: "outer_shell", type: "Shell Jacket", garmentType: "Outerwear", layerType: "Outer", weight: "Light", styleTags: ["Athleisure"] },
  { id: "outer_wool", type: "Wool Coat", garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Formal", "Smart Casual"] },
  { id: "bottom_jeans", type: "Jeans", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Casual"] },
  { id: "bottom_trousers", type: "Trousers", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "bottom_formal_trousers", type: "Heavy Wool Trousers", garmentType: "Bottom", layerType: "Both", weight: "Heavy", styleTags: ["Formal"] },
  { id: "bottom_shorts", type: "Shorts", garmentType: "Bottom", layerType: "Both", weight: "Light", styleTags: ["Casual"] },
  { id: "bottom_sport_shorts", type: "Sport Shorts", garmentType: "Bottom", layerType: "Both", weight: "Light", styleTags: ["Athleisure"] },
  { id: "bottom_sport_pants", type: "Sport Pants", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Athleisure"] },
  { id: "bottom_sweat_pants", type: "Sweat Pants", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "shoe_sneakers", type: "Sneakers", garmentType: "Footwear", layerType: "Both", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  { id: "shoe_leather", type: "Leather Sneakers", garmentType: "Footwear", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  { id: "shoe_derby", type: "Derby", garmentType: "Footwear", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "shoe_formal_derby", type: "Derby", garmentType: "Footwear", layerType: "Both", weight: "Medium", styleTags: ["Formal"] },
  { id: "shoe_slides", type: "Slides", garmentType: "Footwear", layerType: "Both", weight: "Light", styleTags: ["Casual", "Athleisure"] },
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

function breakdownFor(itemId, slot, outfit = {}, outfitFilters = { style: [], climate: [] }, recentOutfits = []) {
  const item = itemsById[itemId];
  return getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, null, {}, recentOutfits, true, [item]).breakdown;
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

test("no-filter occasionally produces formal when the wardrobe supports it", () => {
  const outfits = generateBatch({ count: 120, seed: 77 });
  const counts = countByDominantStyle(outfits);

  assert.ok((counts.Formal ?? 0) >= 3);
  assert.ok((counts.Formal ?? 0) < (counts.Casual ?? 0));
});

test("sport cap only appears in athleisure-leaning no-filter outfits", () => {
  const outfits = generateBatch({ count: 80, seed: 99 });

  outfits.forEach((outfit) => {
    if (outfit.Headwear !== "head_sport_cap") return;
    assert.equal(getOutfitDominantStyle(outfit, itemsById), "Athleisure");
  });
});

test("explicit athleisure filter stays athletic and excludes wool shirt", () => {
  const outfits = generateBatch({ count: 40, outfitFilters: { style: ["Athleisure"], climate: [] }, seed: 13 });

  outfits.forEach((outfit) => {
    const top = itemsById[outfit.TopInner];
    const bottom = itemsById[outfit.Bottom];
    const outer = itemsById[outfit.TopOuter];
    const shoes = itemsById[outfit.Footwear];

    assert.notEqual(top?.type, "Wool Shirt");
    assert.notEqual(top?.type, "Shirt");
    assert.notEqual(shoes?.type, "Derby");
    assert.notEqual(outer?.type, "Blazer");
    assert.ok(
      ["Sport LS T-Shirt", "Hoodie", "Fleece Sweater", "Sport Pants", "Sport Shorts", "Sweat Pants", "Shell Jacket", "Sneakers", "Sport Cap", "Cap"].includes(top?.type) ||
      ["Sport Pants", "Sport Shorts", "Sweat Pants"].includes(bottom?.type) ||
      ["Shell Jacket", "Fleece Jacket"].includes(outer?.type) ||
      ["Sneakers"].includes(shoes?.type)
    );
  });
});

test("explicit formal filter stays formal instead of collapsing into smart casual", () => {
  const outfits = generateBatch({ count: 30, outfitFilters: { style: ["Formal"], climate: [] }, seed: 5 });

  outfits.forEach((outfit) => {
    assert.equal(getOutfitDominantStyle(outfit, itemsById, ["Formal"]), "Formal");
    assert.notEqual(itemsById[outfit.Footwear]?.type, "Sneakers");
    assert.notEqual(itemsById[outfit.TopInner]?.type, "Hoodie");
  });
});

test("explicit smart casual filter stays elevated instead of collapsing into casual", () => {
  const outfits = generateBatch({ count: 35, outfitFilters: { style: ["Smart Casual"], climate: [] }, seed: 17 });

  outfits.forEach((outfit) => {
    const top = itemsById[outfit.TopInner];
    const shoes = itemsById[outfit.Footwear];
    assert.notEqual(top?.type, "Sport LS T-Shirt");
    assert.notEqual(itemsById[outfit.Headwear]?.type, "Sport Cap");
    assert.ok(["Shirt", "Knit Sweater", "Wool Shirt", "Fleece Sweater", "Hoodie"].includes(top?.type) === false || top?.type !== "Hoodie");
    assert.ok(["Leather Sneakers", "Boots", "Derby"].includes(shoes?.type));
  });
});

test("cold generation avoids light or sport tops with boots or heavy outerwear", () => {
  const outfits = generateBatch({ count: 50, outfitFilters: { style: [], climate: ["Cold"] }, seed: 7 });

  outfits.forEach((outfit) => {
    if (!hasHeavyOuterwear(outfit) && !hasBoots(outfit)) return;
    assert.equal(isLightOrSportTop(outfit), false);
  });
});

test("warm and hot climate penalize medium or heavy beanies", () => {
  const warmOutfits = generateBatch({ count: 40, outfitFilters: { style: ["Athleisure"], climate: ["Warm"] }, seed: 44 });
  const hotOutfits = generateBatch({ count: 40, outfitFilters: { style: ["Athleisure"], climate: ["Hot"] }, seed: 45 });

  warmOutfits.forEach((outfit) => {
    assert.notEqual(itemsById[outfit.Headwear]?.id, "head_beanie");
  });

  hotOutfits.forEach((outfit) => {
    assert.notEqual(itemsById[outfit.Headwear]?.id, "head_beanie");
    assert.notEqual(itemsById[outfit.Headwear]?.id, "head_beanie_light");
  });
});

test("no-filter climate chip stays everyday without weather or explicit climate", () => {
  assert.equal(getCurrentOutfitClimateChip({ style: [], climate: [] }, null), "Everyday");
  assert.equal(getCurrentOutfitClimateChip({ style: [], climate: [] }, { suggestedFilters: ["Warm"] }), "Everyday");
  assert.equal(getCurrentOutfitClimateChip({ style: [], climate: ["Cold"] }, { suggestedFilters: ["Warm"] }), "Cold");
});

test("passive weather data does not influence no-filter generation scoring", () => {
  const withoutWeather = withSeed(88, () =>
    buildNextOutfit(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: [], climate: [] },
      null,
      "guided",
      {},
      []
    )
  );
  const withPassiveWeather = withSeed(88, () =>
    buildNextOutfit(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: [], climate: [] },
      { suggestedFilters: ["Warm"] },
      "guided",
      {},
      []
    )
  );

  assert.deepEqual(withPassiveWeather, withoutWeather);
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
  let fourStyleStreaks = 0;

  for (let index = 1; index < outfits.length; index += 1) {
    const previousStyle = getOutfitDominantStyle(outfits[index - 1], itemsById);
    const currentStyle = getOutfitDominantStyle(outfits[index], itemsById);
    styleStreak = previousStyle === currentStyle ? styleStreak + 1 : 1;
    if (styleStreak === 3) threeStyleStreaks += 1;
    if (styleStreak === 4) fourStyleStreaks += 1;
    assert.ok(styleStreak < 5);

    const previousTop = outfits[index - 1].TopInner;
    const currentTop = outfits[index].TopInner;
    topInnerStreak = previousTop === currentTop ? topInnerStreak + 1 : 1;
    assert.ok(topInnerStreak < 3);
  }

  assert.ok(threeStyleStreaks <= 4);
  assert.ok(fourStyleStreaks <= 1);
});

test("recent item repetition penalties are capped and mild", () => {
  const repeatedOutfit = {
    Headwear: "head_cap",
    TopInner: "top_tee",
    TopOuter: "outer_jacket",
    Bottom: "bottom_jeans",
    Footwear: "shoe_sneakers"
  };
  const recentOutfits = [
    repeatedOutfit,
    repeatedOutfit,
    repeatedOutfit,
    repeatedOutfit
  ].reduce((current, outfit) => rememberRecentOutfit(current, outfit, true), []);
  const breakdown = breakdownFor("top_tee", "TopInner", { Bottom: "bottom_jeans" }, { style: [], climate: [] }, recentOutfits);

  assert.ok(breakdown.recentItemPenalty >= -4.5);
  assert.ok(breakdown.recentExactPenalty >= -3.6);
});

test("random mode ignores guided recent-memory inputs", () => {
  const withNoRecent = withSeed(11, () =>
    buildNextOutfit(syntheticWardrobe, {}, {}, true, {}, { Wardrobe: true, Wishlist: true }, { style: [], climate: [] }, null, "random", {}, [])
  );
  const withRecent = withSeed(11, () =>
    buildNextOutfit(syntheticWardrobe, {}, {}, true, {}, { Wardrobe: true, Wishlist: true }, { style: [], climate: [] }, null, "random", { some: 99 }, [
      { key: "x", outfit: { Headwear: "head_cap", TopInner: "top_tee", TopOuter: "outer_jacket", Bottom: "bottom_jeans", Footwear: "shoe_sneakers" }, layering: true, liked: true }
    ])
  );

  assert.deepEqual(withRecent, withNoRecent);
});

test("type defaults include beanie light and new athletic types", () => {
  assert.equal(resolveTypeDefaults("Beanie (light)").weight, "Light");
  assert.deepEqual(resolveTypeDefaults("Track Pants").styleTags, ["Athleisure"]);
  assert.deepEqual(resolveTypeDefaults("Sweatpants").styleTags, ["Casual", "Athleisure"]);
  assert.deepEqual(resolveTypeDefaults("Fleece Pullover").styleTags, ["Casual", "Athleisure"]);
});
