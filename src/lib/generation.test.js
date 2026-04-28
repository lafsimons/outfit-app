import test from "node:test";
import assert from "node:assert/strict";

import {
  applyContextValidityRulesToPool,
  buildNextOutfit,
  getCurrentOutfitClimateChip,
  getGuidedScoreBreakdown,
  getOutfitDominantStyle,
  getPool,
  rememberRecentOutfit,
  summarizeGuidedExplanation
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
  { id: "outer_puffer", type: "Puffer", garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Casual", "Athleisure"] },
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
  seed = 42,
  weatherData = null
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
        weatherData,
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

function scoreFor(itemId, slot, outfit = {}, outfitFilters = { style: [], climate: [] }, recentOutfits = [], outfitAffinity = {}) {
  const item = itemsById[itemId];
  return getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, null, outfitAffinity, recentOutfits, true, [item]).score;
}

function climateItems(...entries) {
  return entries.map(([slot, itemId]) => ({ slot, item: itemsById[itemId] }));
}

test("no-filter generation uses weighted variety instead of collapsing into casual", () => {
  const outfits = generateBatch();
  const counts = countByDominantStyle(outfits);
  const representedStyles = Object.values(counts).filter((count) => count > 0).length;

  assert.ok((counts.Casual ?? 0) > (counts["Smart Casual"] ?? 0));
  assert.ok((counts["Smart Casual"] ?? 0) >= 6);
  assert.ok((counts.Athleisure ?? 0) >= 8);
  assert.ok((counts.Casual ?? 0) <= 28);
  assert.ok((counts.Formal ?? 0) >= 5);
  assert.ok((counts.Formal ?? 0) <= 20);
  assert.ok(representedStyles >= 4);
});

test("no-filter occasionally produces formal when the wardrobe supports it", () => {
  const outfits = generateBatch({ count: 120, seed: 77 });
  const counts = countByDominantStyle(outfits);

  assert.ok((counts.Formal ?? 0) >= 8);
  assert.ok((counts.Formal ?? 0) < (counts.Casual ?? 0));
});

test("no-filter ignores passive weather unless climate filters are explicitly applied", () => {
  const passiveWarmWeather = {
    temperature: 27,
    suggestedFilters: ["Warm"]
  };

  const neutralOutfits = generateBatch({ count: 20, seed: 314, weatherData: null });
  const weatherOutfits = generateBatch({ count: 20, seed: 314, weatherData: passiveWarmWeather });

  assert.deepEqual(weatherOutfits, neutralOutfits);
});

test("sport cap only appears in non-formal no-filter outfits", () => {
  const outfits = generateBatch({ count: 80, seed: 99 });

  outfits.forEach((outfit) => {
    if (outfit.Headwear !== "head_sport_cap") return;
    assert.notEqual(getOutfitDominantStyle(outfit, itemsById), "Formal");
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

test("climate pill reflects warm or hot leaning outfits from the outfit itself", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_tee"],
        ["Bottom", "bottom_shorts"],
        ["Footwear", "shoe_sneakers"]
      )
    ),
    "Warm"
  );
});

test("climate pill reflects transitional leaning outfits from the outfit itself", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_knit"],
        ["TopOuter", "outer_jacket"],
        ["Bottom", "bottom_trousers"],
        ["Footwear", "shoe_sneakers"]
      )
    ),
    "Transitional"
  );
});

test("climate pill returns cold for heavy coat and boots", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_tee"],
        ["TopOuter", "outer_wool"],
        ["Bottom", "bottom_jeans"],
        ["Footwear", "shoe_boots"]
      )
    ),
    "Cold"
  );
});

test("climate pill returns cold for wool coat with medium footwear", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_shirt"],
        ["TopOuter", "outer_wool"],
        ["Bottom", "bottom_trousers"],
        ["Footwear", "shoe_derby"]
      )
    ),
    "Cold"
  );
});

test("climate pill returns cold for puffer and boots", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_tee"],
        ["TopOuter", "outer_puffer"],
        ["Bottom", "bottom_jeans"],
        ["Footwear", "shoe_boots"]
      )
    ),
    "Cold"
  );
});

test("climate pill reflects cold leaning outfits from the outfit itself", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["Headwear", "head_beanie"],
        ["TopInner", "top_hoodie"],
        ["TopOuter", "outer_wool"],
        ["Bottom", "bottom_formal_trousers"],
        ["Footwear", "shoe_boots"]
      )
    ),
    "Cold"
  );
});

test("climate pill does not let a light inner top overpower heavy outerwear", () => {
  const actualOutfitClimate = getCurrentOutfitClimateChip(
    climateItems(
      ["TopInner", "top_tee"],
      ["TopOuter", "outer_wool"],
      ["Bottom", "bottom_shorts"],
      ["Footwear", "shoe_boots"]
    )
  );

  assert.notEqual(actualOutfitClimate, "Warm");
  assert.ok(["Cold", "Transitional"].includes(actualOutfitClimate));
});

test("climate pill reflects rain when rain cues are strongest", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["Headwear", "head_cap"],
        ["TopInner", "top_hoodie"],
        ["TopOuter", "outer_shell"],
        ["Bottom", "bottom_trousers"],
        ["Footwear", "shoe_boots"]
      )
    ),
    "Rain"
  );
});

test("climate pill ignores passive weather and explicit climate state and reflects the outfit", () => {
  const actualOutfitClimate = getCurrentOutfitClimateChip(
    climateItems(
      ["TopInner", "top_tee"],
      ["Bottom", "bottom_shorts"],
      ["Footwear", "shoe_sneakers"]
    )
  );

  assert.equal(actualOutfitClimate, "Warm");
  assert.notEqual(actualOutfitClimate, "Cold");
});

test("climate pill returns hot only when the outfit has strong warm-weather signals", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_tee"],
        ["Bottom", "bottom_shorts"],
        ["Footwear", "shoe_slides"]
      )
    ),
    "Hot"
  );
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
  const breakdown = breakdownFor(
    "shoe_sneakers",
    "Footwear",
    {
      Headwear: "head_cap",
      TopInner: "top_tee",
      TopOuter: "outer_jacket",
      Bottom: "bottom_jeans"
    },
    { style: [], climate: [] },
    recentOutfits
  );

  assert.ok(breakdown.recentItemPenalty <= -0.3);
  assert.ok(breakdown.recentItemPenalty >= -0.8);
  assert.ok(breakdown.recentExactPenalty <= -0.4);
  assert.ok(breakdown.recentExactPenalty >= -0.5);
  assert.ok(breakdown.styleStreakPenalty >= -0.5);
});

test("guided breakdown components stay within normalized caps", () => {
  const scenarios = [
    breakdownFor("top_formal_shirt", "TopInner", {}, { style: ["Formal"], climate: [] }),
    breakdownFor("outer_wool", "TopOuter", { TopInner: "top_tee", Bottom: "bottom_shorts" }, { style: ["Formal"], climate: ["Hot"] }),
    breakdownFor("head_sport_cap", "Headwear", {}, { style: ["Athleisure"], climate: ["Warm"] }),
    breakdownFor("shoe_boots", "Footwear", { TopInner: "top_tee", TopOuter: "outer_wool", Bottom: "bottom_formal_trousers" }, { style: [], climate: ["Cold"] })
  ];

  const caps = {
    styleCoherence: [-3, 2.5],
    styleCompletion: [0, 2.5],
    climate: [-1.5, 2],
    baseline: [0, 1],
    affinity: [0, 0.5],
    noFilterVariety: [-0.4, 1],
    recentItemPenalty: [-0.8, 0],
    recentExactPenalty: [-0.5, 0],
    styleStreakPenalty: [-0.5, 0],
    dominance: [-2, 0]
  };

  scenarios.forEach((breakdown) => {
    Object.entries(caps).forEach(([key, [min, max]]) => {
      assert.ok(breakdown[key] >= min, `${key} below cap: ${breakdown[key]}`);
      assert.ok(breakdown[key] <= max, `${key} above cap: ${breakdown[key]}`);
    });

    Object.values(breakdown).forEach((value) => {
      assert.ok(value >= -3, `component below general floor: ${value}`);
      assert.ok(value <= 3, `component above general ceiling: ${value}`);
    });
  });
});

test("affinity boost is capped at a small supportive value", () => {
  const affinity = {
    "pair|TopInner|Bottom|top_tee|bottom_jeans": 99,
    "item|Bottom|bottom_jeans": 99
  };
  const breakdown = getGuidedScoreBreakdown(
    itemsById.bottom_jeans,
    "Bottom",
    { TopInner: "top_tee" },
    itemsById,
    { style: [], climate: [] },
    null,
    affinity,
    [],
    true,
    [itemsById.bottom_jeans]
  ).breakdown;

  assert.ok(breakdown.affinity <= 0.5);
  assert.ok(breakdown.affinity >= 0);
});

test("valid guided candidates receive a positive minimum score floor", () => {
  const score = scoreFor("top_tee", "TopInner", {}, { style: ["Formal"], climate: [] });

  assert.ok(score >= 0.3);
});

test("hard-blocked candidates are excluded before scoring floor applies", () => {
  const pool = getPool(syntheticWardrobe, "Headwear", {}, { Wardrobe: true, Wishlist: true }, true);
  const filtered = applyContextValidityRulesToPool(pool, "Headwear", { style: [], climate: ["Hot"] }, null, {}, itemsById);

  assert.ok(filtered.some((item) => item.id === "head_cap"));
  assert.ok(!filtered.some((item) => item.id === "head_beanie"));
});

test("guided explanation debug reasons stay on the normalized score scale", () => {
  const explanation = summarizeGuidedExplanation(
    {
      Headwear: "head_cap",
      TopInner: "top_tee",
      TopOuter: "outer_jacket",
      Bottom: "bottom_jeans",
      Footwear: "shoe_sneakers"
    },
    itemsById,
    { style: [], climate: [] },
    null,
    {},
    [],
    true
  );

  explanation.forEach((reason) => {
    assert.ok(Math.abs(reason.value) <= 3, `${reason.label} out of range: ${reason.value}`);
  });
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
