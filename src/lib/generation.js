import {
  defaultItemList,
  getTypeMatchKeys,
  getItemLayerRoles,
  isShirtLayeringType,
  itemLists,
  normalizeStatus,
  normalizeTagList,
  normalizeType,
  normalizeWeight,
  resolveTypeDefaults,
  styleTagOptions
} from "./typeDefaults.js";

export const visibleSlots = ["Headwear", "TopInner", "TopMid", "TopOuter", "Bottom", "Footwear"];
export const generationOrder = ["Bottom", "TopOuter", "Footwear", "TopMid", "TopInner", "Headwear"];
export const topSlots = ["TopInner", "TopMid", "TopOuter"];

// Preserve the persisted boolean modes and their existing outfit keys.
export function normalizeLayering(value) {
  return value === 3 ? 3 : Boolean(value);
}

export function getLayerCount(layering) {
  return layering === 3 ? 3 : layering ? 2 : 1;
}

export function getActiveOutfitSlots(layering) {
  return visibleSlots.filter((slot) =>
    (slot !== "TopMid" || layering === 3) && (slot !== "TopOuter" || Boolean(layering))
  );
}

export function getActiveOutfit(outfit = {}, layering = true) {
  const result = { ...outfit };
  if (layering !== 3) delete result.TopMid;
  if (!layering) result.TopOuter = null;
  return result;
}

export function normalizeOutfitStructure(outfit, locked, layering, itemsById) {
  const next = getActiveOutfit(outfit, layering);
  const nextLocked = { ...locked };
  const active = getActiveOutfitSlots(layering);
  for (const slot of visibleSlots) {
    if (!active.includes(slot)) {
      delete nextLocked[slot];
      continue;
    }
    const item = itemsById[next[slot]];
    if (!item || !matchesSlotBaseValidity(item, slot, layering)) {
      next[slot] = null;
      delete nextLocked[slot];
    }
  }
  return { outfit: next, locked: nextLocked };
}

export function getStructuralIssues(outfit, locked, layering, itemsById) {
  const active = getActiveOutfit(outfit, layering);
  const issues = [];
  for (const slot of getActiveOutfitSlots(layering)) {
    const item = itemsById[active[slot]];
    if (!item || !locked[slot]) continue;
    const otherLocked = Object.fromEntries(Object.entries(active).filter(([other]) => other !== slot && locked[other]));
    if (!filterPoolForLayeringRules([item], slot, otherLocked, itemsById).length
        || !filterPoolForCompatibilityRules([item], slot, otherLocked, itemsById).length) {
      issues.push(`${slot}: incompatible locked garments; unlock one to resolve the conflict.`);
    }
  }
  return issues;
}

export function getGenerationDebugSignature({ outfit, locked, layering, itemsById, items, outfitFilters, generationLists, excluded, generationMode, outfitAffinity, recentOutfits }) {
  return JSON.stringify({
    outfit: getActiveOutfit(outfit, layering),
    locked: Object.fromEntries(getActiveOutfitSlots(layering).map(slot => [slot, Boolean(locked?.[slot])])),
    layering, outfitFilters: normalizeOutfitFilters(outfitFilters), generationLists: generationLists ?? defaultGenerationLists, excluded: excluded ?? {}, generationMode: normalizeGenerationMode(generationMode),
    outfitAffinity: normalizeOutfitAffinity(outfitAffinity), recentOutfits: normalizeRecentOutfits(recentOutfits),
    source: items.map(item => item.id).sort(),
    metadata: Object.values(itemsById).map(item => [item.id, item.type, item.garmentType, getItemLayerRoles(item), item.weight, item.styleTags, item.climateTags, item.favorite, item.status, item.list, item.collections]).sort((a, b) => a[0].localeCompare(b[0]))
  });
}

function recordSelectionContext(payload, context, finalOutfit, rememberGeneration = false) {
  if (!payload.length) return payload;
  payload[0].selectionContext = {
    ...JSON.parse(getGenerationDebugSignature(context)),
    expectedPostActionRecentHistory: rememberGeneration
      ? rememberRecentOutfit(context.recentOutfits, finalOutfit, context.layering, { preserveLiked: true })
      : normalizeRecentOutfits(context.recentOutfits)
  };
  return payload;
}

export function transitionOutfitLayering(previous, locked, nextLayering, items, options = {}) {
  const itemsById = options.itemsById ?? Object.fromEntries(items.map(item => [item.id, item]));
  const result = normalizeOutfitStructure(previous, locked, nextLayering, itemsById);
  const next = result.outfit;
  const nextLocked = result.locked;
  for (const slot of topSlots) { delete next[slot]; delete nextLocked[slot]; }
  const activeTops = topSlots.filter(slot => getActiveOutfitSlots(nextLayering).includes(slot));
  if (!nextLayering) {
    const candidates = ["TopOuter", "TopMid", "TopInner"].filter(slot => {
      const item = itemsById[previous[slot]];
      return item && matchesSlotBaseValidity(item, "TopInner", nextLayering);
    });
    const retained = candidates.find(slot => locked[slot]) ?? candidates[0];
    if (retained) {
      next.TopInner = previous[retained];
      if (locked[retained]) nextLocked.TopInner = true;
    }
  } else {
    // Keep valid placements before moving garments whose role no longer fits.
    const retained = new Set();
    for (const slot of activeTops) {
      const item = itemsById[previous[slot]];
      if (item && matchesSlotBaseValidity(item, slot, nextLayering) && !retained.has(item.id)) {
        next[slot] = item.id;
        retained.add(item.id);
        if (locked[slot]) nextLocked[slot] = true;
      }
    }
    const displaced = topSlots.filter(slot => previous[slot] && !retained.has(previous[slot]))
      .sort((a, b) => Number(Boolean(locked[b])) - Number(Boolean(locked[a])));
    for (const oldSlot of displaced) {
      const item = itemsById[previous[oldSlot]];
      if (!item || retained.has(item.id)) continue;
      const target = activeTops.find(slot => !next[slot] && matchesSlotBaseValidity(item, slot, nextLayering)
        && filterPoolForLayeringRules([item], slot, next, itemsById).length
        && filterPoolForCompatibilityRules([item], slot, next, itemsById).length);
      if (target) {
        next[target] = item.id;
        retained.add(item.id);
        if (locked[oldSlot]) nextLocked[target] = true;
      }
    }
  }
  for (const slot of generationOrder.filter(slot => activeTops.includes(slot))) {
    if (next[slot]) continue;
    const pool = getEligibleSlotPool(items, slot, options.excluded, options.generationLists, nextLayering, options.outfitFilters ?? emptyOutfitFilters, options.weatherData, next, itemsById);
    next[slot] = selectNextItemForGeneration(pool, slot, next, itemsById, options.outfitFilters ?? emptyOutfitFilters, options.weatherData, options.generationMode, options.outfitAffinity, options.recentOutfits, nextLayering)?.item.id ?? null;
  }
  return { outfit: getActiveOutfit(next, nextLayering), locked: nextLocked };
}

// Hidden garments live outside the active outfit, so they cannot influence selection
// or likes. Any edit to the active outfit starts a new transition history.
export function transitionOutfitLayeringWithMemory(previous, locked, previousLayering, nextLayering, items, memory = {}, options = {}) {
  const stateKey = (outfit, locks, layering) => JSON.stringify([
    getOutfitKey(outfit, layering),
    getActiveOutfitSlots(layering).map(slot => Boolean(locks[slot]))
  ]);
  const unchanged = memory.current === stateKey(previous, locked, previousLayering);
  const snapshots = unchanged ? { ...memory.snapshots } : {};
  snapshots[getLayerCount(previousLayering)] = { outfit: { ...previous }, locked: { ...locked } };
  const remembered = snapshots[getLayerCount(nextLayering)]
    ?? (nextLayering ? snapshots[3] ?? snapshots[2] : null);
  let source = previous;
  let sourceLocks = locked;
  if (remembered) {
    source = { ...previous };
    sourceLocks = { ...locked };
    for (const slot of topSlots) {
      source[slot] = remembered.outfit[slot] ?? null;
      delete sourceLocks[slot];
      if (remembered.locked[slot]) sourceLocks[slot] = true;
    }
  }
  const result = transitionOutfitLayering(source, sourceLocks, nextLayering, items, options);
  return {
    ...result,
    memory: { snapshots, current: stateKey(result.outfit, result.locked, nextLayering) }
  };
}

export function rerollOutfitSlot(items, outfit, locked, slot, layering, options = {}) {
  const itemsById = options.itemsById ?? Object.fromEntries(items.map(item => [item.id, item]));
  const normalized = normalizeOutfitStructure(outfit, locked, layering, itemsById);
  if (normalized.locked[slot] || !getActiveOutfitSlots(layering).includes(slot)) return { ...normalized, guidedDebugPayload: [] };
  const context = { ...normalized.outfit, [slot]: null };
  const pool = getEligibleSlotPool(items, slot, options.excluded, options.generationLists, layering, options.outfitFilters ?? emptyOutfitFilters, options.weatherData, context, itemsById)
    .filter(item => item.id !== outfit[slot]);
  const selection = selectNextItemForGeneration(pool, slot, context, itemsById, options.outfitFilters ?? emptyOutfitFilters, options.weatherData, options.generationMode, options.outfitAffinity, options.recentOutfits, layering);
  return {
    ...normalized,
    outfit: { ...context, [slot]: selection?.item.id ?? null },
    guidedDebugPayload: normalizeGenerationMode(options.generationMode) === "guided" ? recordSelectionContext(
      [{ slot, itemId: selection?.item.id ?? null, score: selection?.score ?? null, breakdown: selection?.breakdown ?? {}, topCandidates: selection?.topCandidates ?? [], reason: !selection ? "No eligible replacement candidates." : null, selectionOutfit: context }],
      { ...options, outfit: context, locked: normalized.locked, layering, itemsById, items },
      { ...context, [slot]: selection?.item.id ?? null }
    ) : []
  };
}
export const accessorySlots = ["Glasses", "Neck", "LeftHand", "RightHand", "Bag", "Belt"];
export const defaultGenerationLists = {
  Interested: false,
  Wishlist: false,
  Incoming: false,
  Wardrobe: true,
  Selling: false,
  Sold: false,
  Archived: false
};

function isGenerationListExplicitlyExcluded(value) {
  return value === "exclude";
}
export const climateTagOptions = ["Cold", "Warm", "Hot", "Snow", "Rain", "Transitional"];
export const editableClimateTagOptions = ["Rain", "Snow"];
export const outfitFilterOptions = {
  climate: climateTagOptions,
  style: styleTagOptions
};
export const emptyOutfitFilters = {
  style: [],
  styleExcluded: [],
  climate: [],
  climateExcluded: [],
  collections: [],
  collectionsExcluded: []
};
export const generationModes = ["guided", "random"];
export const defaultGenerationMode = "guided";
export const RECENT_OUTFIT_WINDOW = 8;
const GUIDED_BASE_SCORE = 0.8;
const GUIDED_SCORE_FLOOR = 0.3;
const GUIDED_DEBUG_TOP_CANDIDATE_LIMIT = 5;
const MAX_RECENT_ITEM_PENALTY = -0.8;
const MAX_RECENT_EXACT_PENALTY = -0.5;
const MAX_AFFINITY_BOOST = 0.5;
const recentItemPenaltySteps = [0.22, 0.11, 0.04, 0.02, 0.01];
const recentSlotPenaltySteps = [0.08, 0.04, 0.01, 0.005, 0.005];
const recentExactPenaltySteps = [0.4, 0.2, 0.1, 0.05];
const recentLikedBoostSteps = [0.12, 0.08, 0.04, 0.02];
const guidedScoreNormalizers = {
  climate: { scale: 0.45, min: -1.5, max: 2 },
  styleCoherence: { scale: 0.28, min: -3, max: 2.5 },
  styleCompletion: { scale: 0.4, min: 0, max: 2.5 },
  dominance: { scale: 0.6, min: -2, max: 0 },
  styleConflict: { scale: 0.65, min: -1.5, max: 0 },
  hotOuterwear: { scale: 0.65, min: -1.5, max: 0 },
  earlyAnchor: { scale: 0.55, min: 0, max: 1.2 },
  selectedStyleBonus: { scale: 0.45, min: 0, max: 1.4 },
  favorite: { scale: 0.6, min: 0, max: 0.3 },
  affinity: { scale: 1, min: 0, max: MAX_AFFINITY_BOOST },
  recentItemPenalty: { scale: 1, min: MAX_RECENT_ITEM_PENALTY, max: 0 },
  recentExactPenalty: { scale: 1, min: MAX_RECENT_EXACT_PENALTY, max: 0 },
  recentLikedBoost: { scale: 1, min: 0, max: 0.35 },
  coldOuterwear: { scale: 0.45, min: -1.2, max: 1 },
};

const nonStackableTopTypes = new Set(["sweatshirt", "jacket"]);
const affinityRelationships = [
  ["TopInner", "Bottom"],
  ["Bottom", "Footwear"],
  ["TopOuter", "TopInner"],
  ["TopOuter", "Bottom"],
  ["TopOuter", "TopMid"],
  ["TopMid", "TopInner"],
  ["TopMid", "Bottom"]
];
const guidedExplanationLabels = {
  climate: "Climate suitability",
  styleCoherence: "Style match",
  styleCompletion: "Style completion",
  dominance: "Style consistency",
  styleConflict: "Cross-style conflict penalty",
  hotOuterwear: "Outerwear adjusted for heat",
  earlyAnchor: "Early style anchoring",
  selectedStyleBonus: "Selected style bonus",
  favorite: "Favorite item boost",
  affinity: "Liked combo affinity",
  recentItemPenalty: "Recent item repetition penalty",
  recentExactPenalty: "Exact outfit repetition penalty",
  recentLikedBoost: "Recent like combo boost",
  coldOuterwear: "Outerwear added for cold",
  startingWeight: "Starting weight",
  minimumWeightAdjustment: "Minimum weight adjustment",
};

function normalizeBooleanLookup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, isEnabled]) => Boolean(isEnabled)).map(([key]) => [key, true])
  );
}

function normalizeAffinityMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [key, Math.max(0, Math.round(Number(count) || 0))])
      .filter(([, count]) => count > 0)
  );
}

export function pickRandom(items) {
  if (!items.length) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function pickWeightedRandom(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

  if (!totalWeight) {
    return pickRandom(entries.map((entry) => entry.item));
  }

  let remaining = Math.random() * totalWeight;

  for (const entry of entries) {
    remaining -= Math.max(0, entry.weight);
    if (remaining <= 0) {
      return entry.item;
    }
  }

  return entries.at(-1)?.item ?? null;
}

export function getOutfitKey(outfit, layering) {
  return JSON.stringify({
    layering: normalizeLayering(layering),
    slots: Object.fromEntries(visibleSlots.filter((slot) => slot !== "TopMid" || layering === 3).map((slot) => [slot, getActiveOutfitSlots(layering).includes(slot) ? outfit?.[slot] ?? null : null]))
  });
}

function buildAffinityPairKey(sourceSlot, targetSlot, sourceItemId, targetItemId) {
  return ["pair", sourceSlot, targetSlot, sourceItemId, targetItemId].join("|");
}

function buildAffinityItemKey(slot, itemId) {
  return ["item", slot, itemId].join("|");
}

function getAffinityUpdatesForOutfit(outfit, layering) {
  outfit = getActiveOutfit(outfit, layering);
  const updates = {};

  affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
    const sourceItemId = outfit?.[sourceSlot];
    const targetItemId = outfit?.[targetSlot];

    if (!sourceItemId || !targetItemId) {
      return;
    }

    const pairKey = buildAffinityPairKey(sourceSlot, targetSlot, sourceItemId, targetItemId);
    updates[pairKey] = (updates[pairKey] ?? 0) + 1;
  });

  generationOrder.filter(slot => getActiveOutfitSlots(layering).includes(slot)).forEach((slot) => {
    const itemId = outfit?.[slot];

    if (!itemId) {
      return;
    }

    const itemKey = buildAffinityItemKey(slot, itemId);
    updates[itemKey] = (updates[itemKey] ?? 0) + 1;
  });

  return updates;
}

export function applyOutfitAffinityDelta(currentAffinity, outfit, delta, layering = true) {
  const nextAffinity = { ...normalizeAffinityMap(currentAffinity) };
  const updates = getAffinityUpdatesForOutfit(outfit, layering);

  Object.entries(updates).forEach(([key, count]) => {
    const nextCount = Math.max(0, (nextAffinity[key] ?? 0) + count * delta);

    if (nextCount > 0) {
      nextAffinity[key] = nextCount;
    } else {
      delete nextAffinity[key];
    }
  });

  return nextAffinity;
}

function sanitizeRecentOutfitSlots(outfit, layering) {
  return Object.fromEntries(visibleSlots.filter((slot) => slot !== "TopMid" || layering === 3).map((slot) => [slot, getActiveOutfitSlots(layering).includes(slot) ? outfit?.[slot] ?? null : null]));
}

function normalizeRecentOutfitEntry(entry) {
  const layering = normalizeLayering(entry?.layering);
  const outfit = sanitizeRecentOutfitSlots(entry?.outfit, layering);

  return {
    key: getOutfitKey(outfit, layering),
    outfit,
    layering,
    liked: Boolean(entry?.liked)
  };
}

export function normalizeRecentOutfits(value) {
  const result = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const entry = normalizeRecentOutfitEntry(raw);
    const existing = result.find(current => current.key === entry.key);
    if (existing) existing.liked ||= entry.liked;
    else result.push(entry);
  }
  return result.slice(0, RECENT_OUTFIT_WINDOW);
}

export function rememberRecentOutfit(currentRecentOutfits, outfit, layering, options = {}) {
  const { liked, preserveLiked = false } = options;
  const entry = normalizeRecentOutfitEntry({
    outfit,
    layering,
    liked: Boolean(liked)
  });
  const existing = normalizeRecentOutfits(currentRecentOutfits);
  const previous = existing.find((current) => current.key === entry.key);

  return [
    {
      ...entry,
      liked: typeof liked === "boolean" ? liked : preserveLiked ? previous?.liked || false : false
    },
    ...existing.filter((current) => current.key !== entry.key)
  ].slice(0, RECENT_OUTFIT_WINDOW);
}

export function isEligibleForGeneration(item, excluded = {}, generationLists = defaultGenerationLists) {
  if (excluded[item.id]) {
    return false;
  }

  const list = normalizeStatus(item.status ?? item.list);

  if (Object.hasOwn(generationLists, list)) {
    return generationLists[list] === true;
  }

  if (!itemLists.includes(list)) {
    if (isGenerationListExplicitlyExcluded(generationLists[defaultItemList])) {
      return false;
    }

    return generationLists[defaultItemList] === true;
  }

  return true;
}

export function matchesSlotBaseValidity(item, slot, layering = true) {
  if (slot === "Headwear") return item.garmentType === "Headwear";
  if (slot === "Bottom") return item.garmentType === "Bottom";
  if (slot === "Footwear") return item.garmentType === "Footwear";

  if (topSlots.includes(slot)) {
    if (!["Top", "Outerwear"].includes(item.garmentType)) return false;
    if (slot === "TopInner" && !layering) return true;
    const roles = getItemLayerRoles(item);
    if (slot === "TopInner") return roles.includes("Base");
    if (slot === "TopMid") return layering === 3 && roles.includes("Mid");
    return roles.includes("Outer") || (layering !== 3 && roles.includes("Mid"));
  }

  if (accessorySlots.includes(slot)) {
    return item.garmentType === "Accessory" && item.accessorySlot === slot;
  }

  return false;
}

function getSlotBasePool(items, slot, layering = true) {
  return items.filter((item) => {
    return matchesSlotBaseValidity(item, slot, layering);
  });
}

export function getPool(items, slot, excluded = {}, generationLists = defaultGenerationLists, layering = true) {
  return getSlotBasePool(items, slot, layering).filter((item) => isEligibleForGeneration(item, excluded, generationLists));
}

export function getManualSelectorSlotPool(items, slot, layering = true, outfit = {}, itemsById = {}, generationLists = defaultGenerationLists) {
  outfit = getActiveOutfit(outfit, layering);
  let pool = getSlotBasePool(items, slot, layering).filter((item) => generationLists === null || isEligibleForGeneration(item, {}, generationLists));

  if (layering && topSlots.includes(slot)) {
    const activeOutfit = layering === 3 ? outfit : { ...outfit, TopMid: null };
    pool = filterPoolForLayeringRules(pool, slot, activeOutfit, itemsById);
  }

  return filterPoolForCompatibilityRules(pool, slot, outfit, itemsById);
}

function getEligibleSlotPoolInternal(
  items,
  slot,
  excluded = {},
  generationLists = defaultGenerationLists,
  layering = true,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  outfit = {},
  itemsById = {},
  ruleOptions = {}
) {
  outfit = getActiveOutfit(outfit, layering);
  if (!getActiveOutfitSlots(layering).includes(slot)) return [];
  let pool = getPool(items, slot, excluded, generationLists, layering).filter((item) =>
    outfitFilters?.favorite === "yes" ? Boolean(item.favorite)
      : outfitFilters?.favorite === "no" ? !item.favorite : true
  );

  if (layering && topSlots.includes(slot)) {
    const activeOutfit = layering === 3 ? outfit : { ...outfit, TopMid: null };
    pool = filterPoolForLayeringRules(pool, slot, activeOutfit, itemsById);
  }

  pool = applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData, outfit, itemsById, {
    ...ruleOptions,
    excluded,
    generationLists,
    items,
    layering
  });
  return filterPoolForCompatibilityRules(pool, slot, outfit, itemsById);
}

export function getEligibleSlotPool(
  items,
  slot,
  excluded = {},
  generationLists = defaultGenerationLists,
  layering = true,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  outfit = {},
  itemsById = {},
  ruleOptions = {}
) {
  return getEligibleSlotPoolInternal(items, slot, excluded, generationLists, layering, outfitFilters, weatherData, outfit, itemsById, ruleOptions);
}

function inferStyleTags(item) {
  const manualTags = normalizeTagList(item.styleTags, styleTagOptions);

  if (manualTags.length) {
    return manualTags;
  }

  return normalizeTagList(resolveTypeDefaults(item.type).styleTags, styleTagOptions);
}

function inferClimateTags(item) {
  const typeMatches = getTypeMatchKeys(item.type);
  const garmentType = item.garmentType;
  const weight = normalizeWeight(item.weight);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  return climateTagOptions.filter((climate) => {
    if (climate === "Hot") {
      return (
        weight === "Light" ||
        hasType("shorts", "sandals", "t-shirt", "shirt", "casual shirt")
      ) && weight !== "Heavy" && garmentType !== "Outerwear" && !hasType("coat", "boots");
    }

    if (climate === "Warm") {
      return (
        weight === "Light" ||
        weight === "Medium" ||
        hasType("shorts", "sandals", "sneakers", "t-shirt", "shirt", "casual shirt", "trousers", "jeans")
      ) && weight !== "Heavy" && !hasType("coat", "boots", "beanie", "scarf");
    }

    if (climate === "Cold" || climate === "Snow") {
      return (
        weight === "Heavy" ||
        garmentType === "Outerwear" ||
        hasType("coat", "jacket", "knit", "sweatshirt", "hoodie", "boots", "beanie", "scarf")
      ) && !hasType("shorts", "sandals");
    }

    if (climate === "Rain") {
      return garmentType === "Outerwear" || hasType("coat", "jacket", "boots", "cap", "shell jacket");
    }

    if (climate === "Transitional") {
      return (
        weight === "Medium" ||
        hasType("jacket", "knit", "shirt", "casual shirt", "trousers", "jeans", "sneakers", "blazer")
      ) && weight !== "Heavy" && !hasType("shorts", "coat");
    }

    return false;
  });
}

export function getItemStyleTags(item) {
  return inferStyleTags(item);
}

export function getItemClimateTags(item) {
  return [...new Set([...inferClimateTags(item), ...normalizeTagList(item.climateTags, climateTagOptions)])];
}

export function hasActiveOutfitFilters(outfitFilters) {
  return ["yes", "no"].includes(outfitFilters?.favorite) || [
    ...Object.keys(outfitFilterOptions),
    "styleExcluded",
    "climateExcluded",
    "collections",
    "collectionsExcluded"
  ].some((group) => {
    const values = outfitFilters?.[group];
    return Array.isArray(values) && values.length > 0;
  });
}

export function normalizeGenerationMode(mode) {
  return generationModes.includes(mode) ? mode : defaultGenerationMode;
}

function getGenerationClimatePreferences(outfitFilters, weatherData) {
  if (Array.isArray(outfitFilters?.climate) && outfitFilters.climate.length) {
    return outfitFilters.climate;
  }

  return [];
}

function getExcludedGenerationClimatePreferences(outfitFilters) {
  if (Array.isArray(outfitFilters?.climateExcluded) && outfitFilters.climateExcluded.length) {
    return outfitFilters.climateExcluded;
  }

  return [];
}

function getPickedOutfitItems(outfit, itemsById) {
  return visibleSlots.map((slot) => itemsById[outfit[slot]]).filter(Boolean);
}

const climateTieBreakPriority = {
  Transitional: 5,
  Warm: 4,
  Hot: 3,
  Cold: 2,
  Snow: 1,
  Rain: 0
};

function getOutfitClimateWeight(item, slot) {
  const weight = normalizeWeight(item.weight);
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (slot === "TopOuter") {
    if (item.garmentType !== "Outerwear") return 1.9;
    if (weight === "Heavy") {
      return hasType("wool coat", "wool jacket", "coat", "puffer", "puffer jacket") ? 4.6 : 4.1;
    }
    return weight === "Medium" ? 3.2 : 2.7;
  }
  if (slot === "TopInner") return weight === "Heavy" ? 1.8 : weight === "Medium" ? 1.45 : 1.1;
  if (slot === "Bottom") return weight === "Heavy" ? 2.1 : 1.9;
  if (slot === "Footwear") return weight === "Heavy" ? 2.8 : 2.2;
  if (slot === "Headwear") return 0.55;
  return 1;
}

function scoreOutfitClimate(items) {
  const scores = Object.fromEntries(climateTagOptions.map((climate) => [climate, 0]));
  let rainSignalCount = 0;
  let hasHeavyOuterwear = false;
  let hasHeavyColdOuterwear = false;
  let hasBoots = false;
  let hasColdHeadwear = false;
  let warmWeatherSignalCount = 0;

  items.forEach(({ item, slot }) => {
    const typeMatches = getTypeMatchKeys(item.type);
    const hasType = (...types) => types.some((type) => typeMatches.has(type));
    const itemClimateTags = new Set(getItemClimateTags(item));
    const baseWeight = getOutfitClimateWeight(item, slot);
    const itemWeight = normalizeWeight(item.weight);

    itemClimateTags.forEach((climate) => {
      scores[climate] += baseWeight;
    });

    if (slot === "TopOuter" && item.garmentType === "Outerwear") {
      if (itemWeight === "Heavy") {
        hasHeavyOuterwear = true;
        scores.Cold += 2.6;
        scores.Snow += 1.1;
        if (hasType("wool coat", "wool jacket", "coat", "puffer", "puffer jacket")) {
          hasHeavyColdOuterwear = true;
          scores.Cold += 2.2;
          scores.Transitional -= 0.4;
        }
      } else if (itemWeight === "Medium") {
        scores.Transitional += 1.2;
        if (hasType("jacket", "wool jacket", "blazer")) {
          scores.Transitional += 0.5;
        }
      }

      if (hasType("shell jacket")) {
        scores.Rain += 2.2;
        scores.Transitional += 0.8;
        rainSignalCount += 2;
      }
    }

    if (slot === "TopInner") {
      if (hasType("hoodie", "sweatshirt", "knit sweater", "fleece sweater")) {
        scores.Cold += 0.65;
        scores.Transitional += 0.8;
      }
      if (hasType("sport t-shirt", "t-shirt")) {
        scores.Warm += 0.55;
        scores.Hot += 0.35;
        warmWeatherSignalCount += 1;
      }
      if (hasType("shirt")) {
        scores.Transitional += 0.45;
      }
    }

    if (slot === "Bottom") {
      if (hasType("shorts", "sport shorts")) {
        scores.Hot += 1.6;
        scores.Warm += 1.1;
        warmWeatherSignalCount += 1;
      }
      if (hasType("trousers", "jeans", "sport pants", "sweat pants")) {
        scores.Transitional += 0.7;
      }
    }

    if (slot === "Footwear") {
      if (hasType("boots")) {
        hasBoots = true;
        scores.Cold += 1.9;
        scores.Rain += 0.8;
        scores.Transitional += 0.35;
        rainSignalCount += 1;
      }
      if (hasType("slides", "sandals")) {
        scores.Hot += 1.4;
        scores.Warm += 0.8;
        warmWeatherSignalCount += 1;
      }
      if (hasType("sneakers", "canvas sneakers")) {
        scores.Warm += 0.5;
        scores.Transitional += 0.4;
      }
    }

    if (slot === "Headwear") {
      if (hasType("beanie")) {
        hasColdHeadwear = true;
        scores.Cold += itemWeight === "Light" ? 0.45 : 0.8;
      }
      if (hasType("cap", "sport cap")) {
        scores.Rain += 0.5;
        scores.Warm += 0.3;
        rainSignalCount += 1;
      }
    }
  });

  if (rainSignalCount >= 3) {
    scores.Rain += 1.8;
  }

  if (scores.Rain < 3.2) {
    scores.Rain -= 1.2;
  }

  if (scores.Hot > 0 && scores.Warm >= scores.Hot - 0.75) {
    scores.Warm += 0.6;
  }

  if (scores.Snow > 0 && scores.Cold >= scores.Snow - 0.9) {
    scores.Cold += 0.6;
  }

  if (scores.Transitional > 0 && scores.Warm > 0 && Math.abs(scores.Transitional - scores.Warm) <= 1.1) {
    scores.Transitional += 0.55;
  }

  if (hasHeavyOuterwear && hasBoots) {
    scores.Cold += 3.2;
    scores.Warm -= 1.8;
    scores.Hot -= 2.2;
  } else if (hasHeavyColdOuterwear && hasColdHeadwear) {
    scores.Cold += 2.2;
    scores.Warm -= 1.2;
  } else if (hasHeavyColdOuterwear) {
    scores.Cold += 1.5;
    scores.Warm -= 0.9;
  }

  if (hasHeavyOuterwear && warmWeatherSignalCount < 2) {
    scores.Warm -= 0.9;
    scores.Hot -= 1.4;
  }

  return scores;
}

export function getCurrentOutfitClimateChip(items) {
  if (!items?.length) {
    return "Everyday";
  }

  const slottedItems = items
    .map((entry) => (entry?.item ? entry : entry ? { item: entry, slot: "Unknown" } : null))
    .filter(Boolean);

  if (!slottedItems.length) {
    return "Everyday";
  }

  const scores = scoreOutfitClimate(slottedItems);
  const ranked = Object.entries(scores).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return (climateTieBreakPriority[right[0]] ?? -1) - (climateTieBreakPriority[left[0]] ?? -1);
  });

  if (!ranked.length || ranked[0][1] <= 0.75) {
    return "Everyday";
  }

  return ranked[0][0];
}

function getDominantStyleCounts(items) {
  const counts = new Map();

  items.forEach((item) => {
    getItemStyleTags(item).forEach((style) => {
      counts.set(style, (counts.get(style) ?? 0) + 1);
    });
  });

  return counts;
}

function rankStyleCounts(counts) {
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function resolveDominantStyleFromCounts(counts, selectedStyles = []) {
  const ranked = rankStyleCounts(counts);

  if (!ranked.length) {
    return selectedStyles?.[0] ?? "Casual";
  }

  const topScore = ranked[0][1];
  const closeSelectedMatch = (selectedStyles ?? []).find((style) => (counts.get(style) ?? 0) >= topScore - 1);

  if (closeSelectedMatch) {
    return closeSelectedMatch;
  }

  const tiedStyles = ranked.filter(([, score]) => score === topScore).map(([style]) => style);
  const selectedMatch = (selectedStyles ?? []).find((style) => tiedStyles.includes(style));
  return selectedMatch ?? tiedStyles[0];
}

function clampScore(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeGuidedScoreComponent(key, value) {
  const config = guidedScoreNormalizers[key];
  if (!config) {
    return value;
  }

  const scaledValue = value * config.scale;
  return clampScore(scaledValue, config.min, config.max);
}

function normalizeGuidedBreakdown(breakdown) {
  return Object.fromEntries(
    Object.entries(breakdown).map(([key, value]) => [key, normalizeGuidedScoreComponent(key, value)])
  );
}

export function classifyOutfitStyle(items, selectedStyles = []) {
  return resolveDominantStyleFromCounts(getDominantStyleCounts(items), selectedStyles);
}

export function getOutfitDominantStyle(outfit, itemsById, selectedStyles = [], layering = true) {
  return classifyOutfitStyle(getPickedOutfitItems(getActiveOutfit(outfit, layering), itemsById), selectedStyles);
}

export function getCurrentOutfitStyleChip(items, selectedStyles) {
  return classifyOutfitStyle(items, selectedStyles);
}

function getClimateScore(item, slot, climatePreferences) {
  if (slot === "TopMid") slot = "TopInner";
  if (!climatePreferences.length) return 0;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const climateTags = new Set(getItemClimateTags(item));
  let score = 0;

  climatePreferences.forEach((climate) => {
    if (climateTags.has(climate)) score += 1.4;

    if (climate === "Hot") {
      if (slot === "Headwear") {
        if (hasType("sport cap", "cap")) score += 1.6;
        if (hasType("beanie")) score -= normalizeWeight(item.weight) === "Light" ? 1.5 : 4.5;
      }
      if (slot === "TopInner") {
        if (hasType("t-shirt", "shirt")) score += 3;
        else if (hasType("ls t-shirt")) score += 1;
        else if (hasType("sweatshirt", "knit sweater", "hoodie", "wool shirt")) score -= 2;
      } else if (slot === "Bottom") {
        if (hasType("shorts", "trousers")) score += 2;
        else if (hasType("jeans")) score += 1;
      } else if (slot === "Footwear") {
        if (hasType("sneakers", "canvas sneakers")) score += 2;
        else if (hasType("slides", "sandals")) score += 1;
        else if (hasType("boots")) score -= 2;
      } else if (slot === "TopOuter") {
        if (item.garmentType === "Outerwear") score -= normalizeWeight(item.weight) === "Heavy" ? 4 : 2;
      }
    }

    if (climate === "Warm") {
      if (slot === "Headwear") {
        if (hasType("sport cap", "cap")) score += 1.1;
        if (hasType("beanie")) score -= normalizeWeight(item.weight) === "Light" ? 0.8 : 2.6;
      }
      if (hasType("t-shirt", "shirt", "sneakers", "canvas sneakers", "trousers", "shorts")) score += 1;
      if (item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") score -= 2;
      if (hasType("scarf")) score -= 3;
    }

    if (climate === "Cold" || climate === "Snow") {
      if (slot === "TopInner") {
        if (hasType("knit sweater", "sweatshirt", "hoodie")) score += 3;
        else if (hasType("shirt", "wool shirt")) score += 1;
        else if (hasType("t-shirt")) score -= 2;
      } else if (slot === "TopOuter") {
        if (hasType("wool coat", "wool jacket")) score += 4;
        else if (hasType("jacket", "twill jacket", "denim jacket", "fleece jacket")) score += 2;
        else if (item.garmentType === "Outerwear") score += 1;
        else score -= 4;
      } else if (slot === "Footwear") {
        if (hasType("boots")) score += 3;
        else if (hasType("leather sneakers")) score += 1;
        else if (hasType("canvas sneakers")) score -= 1;
      }
    }

    if (climate === "Rain") {
      if (slot === "TopOuter" && item.garmentType === "Outerwear") score += 2;
      if (slot === "Footwear" && hasType("boots")) score += 2;
    }

    if (climate === "Transitional") {
      if (hasType("jacket", "twill jacket", "shirt", "trousers", "jeans", "sneakers", "blazer")) score += 1;
      if (normalizeWeight(item.weight) === "Heavy") score -= 1;
    }
  });

  if (climatePreferences.includes("Hot") && hasType("scarf")) score -= 5;
  return score;
}

function isAthleisureOnlyItem(item) {
  const itemStyles = getItemStyleTags(item);
  return itemStyles.length === 1 && itemStyles[0] === "Athleisure";
}

function isFormalOnlyItem(item) {
  const itemStyles = getItemStyleTags(item);
  return itemStyles.length > 0 && itemStyles.every((style) => style === "Formal");
}

function isAthleisureSneaker(item) {
  const typeMatches = getTypeMatchKeys(item.type);
  const itemStyles = getItemStyleTags(item);
  return typeMatches.has("sneakers") && itemStyles.includes("Athleisure");
}

function getFormalCoreSlots(layering) {
  return getActiveOutfitSlots(layering).filter((slot) => slot !== "Headwear");
}

function isStrongFormalAnchor(item, slot) {
  if (!item) return false;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (slot === "TopInner" || slot === "TopMid") {
    return hasType("shirt");
  }

  if (slot === "Bottom") {
    return hasType("trousers", "light trousers", "heavy wool trousers");
  }

  if (slot === "Footwear") {
    return hasType("derby");
  }

  if (slot === "TopOuter") {
    return hasType("blazer", "wool coat", "wool jacket");
  }

  return false;
}

function isFormalBridgeItem(item, slot) {
  if (!item || isStrongFormalAnchor(item, slot)) return false;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const itemStyles = getItemStyleTags(item);
  const hasSmartCasual = itemStyles.includes("Smart Casual");
  const hasFormal = itemStyles.includes("Formal");
  const hasCasual = itemStyles.includes("Casual");
  const hasAthleisure = itemStyles.includes("Athleisure");

  if (hasAthleisure) return false;
  if (hasType("leather sneakers", "boots", "light boots", "boots (chunky, winter, lined)", "knit", "knit sweater", "thick knit sweater", "knit vest")) {
    return true;
  }

  return hasSmartCasual && !hasFormal && hasCasual;
}

function countFormalStructure(outfit, itemsById, layering) {
  return getFormalCoreSlots(layering).reduce(
    (counts, slot) => {
      const item = itemsById[outfit[slot]];

      if (isStrongFormalAnchor(item, slot)) counts.formal += 1;
      else if (isFormalBridgeItem(item, slot)) counts.bridge += 1;

      return counts;
    },
    { formal: 0, bridge: 0 }
  );
}

function hasPotentialFormalAnchorForSlot(slot, outfit, itemsById, context) {
  const pool = getEligibleSlotPoolInternal(
    context.items ?? Object.values(itemsById),
    slot,
    context.excluded ?? {},
    context.generationLists ?? defaultGenerationLists,
    context.layering ?? true,
    context.outfitFilters ?? emptyOutfitFilters,
    context.weatherData ?? null,
    outfit,
    itemsById,
    {
      skipFormalStructure: true
    }
  );

  return pool.some((candidate) => isStrongFormalAnchor(candidate, slot));
}

function hasPotentialNonBridgeForSlot(slot, outfit, itemsById, context) {
  const pool = getEligibleSlotPoolInternal(
    context.items ?? Object.values(itemsById),
    slot,
    context.excluded ?? {},
    context.generationLists ?? defaultGenerationLists,
    context.layering ?? true,
    context.outfitFilters ?? emptyOutfitFilters,
    context.weatherData ?? null,
    outfit,
    itemsById,
    {
      skipFormalStructure: true
    }
  );

  return pool.some((candidate) => !isFormalBridgeItem(candidate, slot));
}

function passesFormalStructureRules(item, currentOutfit, slot, itemsById, context = {}) {
  const layering = context.layering ?? true;
  const nextOutfit = {
    ...currentOutfit,
    [slot]: item.id
  };
  const bottom = itemsById[nextOutfit.Bottom];
  const footwear = itemsById[nextOutfit.Footwear];
  const counts = countFormalStructure(nextOutfit, itemsById, layering);
  const remainingSlots = getFormalCoreSlots(layering).filter((coreSlot) => !nextOutfit[coreSlot]);
  const potentialFormalAnchors = remainingSlots.filter((coreSlot) => hasPotentialFormalAnchorForSlot(coreSlot, nextOutfit, itemsById, context)).length;
  const forcedBridgeSlots = remainingSlots.filter((coreSlot) => !hasPotentialNonBridgeForSlot(coreSlot, nextOutfit, itemsById, context)).length;
  const topInnerNeedsFormalAnchor = ["TopInner", ...(layering === 3 ? ["TopMid"] : [])].some(upperSlot => {
    const upper = itemsById[nextOutfit[upperSlot]];
    return upper ? isStrongFormalAnchor(upper, upperSlot) : hasPotentialFormalAnchorForSlot(upperSlot, nextOutfit, itemsById, context);
  });
  const bottomNeedsFormalAnchor = !bottom ? hasPotentialFormalAnchorForSlot("Bottom", nextOutfit, itemsById, context) : isStrongFormalAnchor(bottom, "Bottom");

  if (counts.bridge > 2) {
    return false;
  }

  if (counts.formal + potentialFormalAnchors < 2) {
    return false;
  }

  if (counts.bridge + forcedBridgeSlots > 2) {
    return false;
  }

  if (counts.formal + potentialFormalAnchors < counts.bridge + forcedBridgeSlots) {
    return false;
  }

  if (footwear && isFormalBridgeItem(footwear, "Footwear")) {
    if (!topInnerNeedsFormalAnchor || !bottomNeedsFormalAnchor) {
      return false;
    }
  }

  if (bottom && !isStrongFormalAnchor(bottom, "Bottom")) {
    if (footwear) {
      if (!isStrongFormalAnchor(footwear, "Footwear")) {
        return false;
      }
    } else if (!hasPotentialFormalAnchorForSlot("Footwear", nextOutfit, itemsById, context)) {
      return false;
    }
  }

  return true;
}

function resolveSelectedStyleMode(selectedStyles) {
  const uniqueStyles = [...new Set((selectedStyles ?? []).filter(Boolean))];

  if (!uniqueStyles.length) return "no-filter";
  if (uniqueStyles.every((style) => style === "Casual")) return "casual";

  const hasFormal = uniqueStyles.includes("Formal");
  const hasSmartCasual = uniqueStyles.includes("Smart Casual");
  const hasAthleisure = uniqueStyles.includes("Athleisure");

  if (hasFormal && hasSmartCasual && hasAthleisure) return "minimal";
  if (hasFormal && hasSmartCasual) return "formal-bridge";
  if (hasFormal && hasAthleisure) return "minimal";
  if (hasSmartCasual && hasAthleisure) return "minimal-bridge";
  if (hasFormal) return "formal";
  if (hasSmartCasual) return "smart-casual";
  if (hasAthleisure) return "athleisure";
  return "casual";
}

function getStyleBlockProfile(styleMode) {
  return {
    styleMode,
    blockFormalSet: styleMode === "formal",
    blockFormalBridgeSet: styleMode === "formal-bridge",
    blockSmartCasualSet: styleMode === "smart-casual",
    blockAthleisureSet: styleMode === "athleisure"
  };
}

function passesSelectedStyleRules(item, slot, selectedStyles, outfit = {}, itemsById = {}, context = {}) {
  const styleMode = resolveSelectedStyleMode(selectedStyles);
  const profile = getStyleBlockProfile(styleMode);
  if (!selectedStyles.length) return true;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const isAthleisureOnly = isAthleisureOnlyItem(item);
  const isFormalOnly = isFormalOnlyItem(item);
  const hasFormalBridgeBlockedType = hasType(
    "shorts",
    "slides",
    "sandals",
    "sport cap",
    "beanie",
    "fleece jacket",
    "shell jacket",
    "hoodie",
    "sweatshirt",
    "sport t-shirt"
  );

  if (profile.blockFormalSet) {
    if (hasType("shorts", "slides", "sandals", "sport cap", "beanie", "fleece jacket", "shell jacket", "hoodie", "sweatshirt", "sport t-shirt", "fleece sweater")) {
      return false;
    }
    if (isAthleisureOnly || isAthleisureSneaker(item)) {
      return false;
    }
    if (slot === "Footwear") {
      const itemStyles = getItemStyleTags(item);
      const hasSmartCasual = itemStyles.includes("Smart Casual");
      const hasFormal = itemStyles.includes("Formal");
      const hasCasual = itemStyles.includes("Casual");
      const hasAthleisure = itemStyles.includes("Athleisure");
      const isBridgeFootwear =
        hasFormal ||
        hasSmartCasual ||
        (hasCasual && hasSmartCasual && !hasAthleisure) ||
        (hasType("leather sneakers") && !hasAthleisure);

      if (!isBridgeFootwear) {
        return false;
      }
    }
    if (!context.skipFormalStructure && !passesFormalStructureRules(item, outfit, slot, itemsById, context)) {
      return false;
    }
  }

  if (profile.blockFormalBridgeSet && hasFormalBridgeBlockedType) return false;

  if (profile.blockSmartCasualSet) {
    if (hasType("slides", "sandals", "sport cap", "beanie", "fleece jacket", "shell jacket", "sport t-shirt", "sport ls t-shirt", "sport shorts", "fleece sweater", "hoodie", "sweatshirt", "sneakers", "sneakers (thin)", "canvas sneakers")) {
      return false;
    }
    if (isAthleisureOnly) {
      return false;
    }
  }

  if (profile.blockAthleisureSet) {
    if (hasType("derby", "wool coat", "wool jacket", "blazer", "shirt", "wool shirt") || isFormalOnly) {
      return false;
    }
    if (getItemStyleTags(item).every((style) => style === "Smart Casual" || style === "Formal")) {
      return false;
    }
  }

  return true;
}

function passesHardContextRules(item, slot, outfitFilters, weatherData, outfit = {}, itemsById = {}, context = {}) {
  const climatePreferences = getGenerationClimatePreferences(outfitFilters, weatherData);
  const excludedClimatePreferences = getExcludedGenerationClimatePreferences(outfitFilters);
  const selectedStyles = outfitFilters.style ?? [];
  const excludedStyles = outfitFilters.styleExcluded ?? [];
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const itemStyles = getItemStyleTags(item);
  const itemClimateTags = getItemClimateTags(item);
  if (excludedStyles.length && itemStyles.some((style) => excludedStyles.includes(style))) {
    return false;
  }

  if (excludedClimatePreferences.length && itemClimateTags.some((climate) => excludedClimatePreferences.includes(climate))) {
    return false;
  }

  if (climatePreferences.includes("Hot")) {
    if (slot === "TopOuter" && item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") return false;
    if (hasType("wool coat")) return false;
    if (slot === "Headwear" && hasType("beanie")) return false;
  }

  if (climatePreferences.includes("Warm")) {
    if (slot === "Headwear" && hasType("beanie") && normalizeWeight(item.weight) !== "Light") return false;
  }

  if (climatePreferences.includes("Cold") || climatePreferences.includes("Snow")) {
    if (hasType("shorts", "slides", "sandals")) return false;
    if (["TopInner", "TopMid"].includes(slot) && hasType("sport t-shirt", "sport ls t-shirt")) return false;

  }

  if (climatePreferences.includes("Rain")) {
    if (hasType("slides", "sandals")) return false;
  }

  return passesSelectedStyleRules(item, slot, selectedStyles, outfit, itemsById, {
    ...context,
    outfitFilters,
    weatherData
  });
}

export function applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData, outfit = {}, itemsById = {}, context = {}) {
  const filtered = pool.filter((item) => passesHardContextRules(item, slot, outfitFilters, weatherData, outfit, itemsById, context));
  return filtered;
}

function getStyleCompletionScore(item, slot, styleMode) {
  if (slot === "TopMid") slot = "TopInner";
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  let score = 0;

  if (styleMode === "formal") {
    if (slot === "TopInner" && hasType("shirt")) score += 6;
    if (slot === "Bottom" && hasType("trousers", "light trousers", "heavy wool trousers")) score += 6;
    if (slot === "Footwear" && hasType("derby")) score += 6;
    if (slot === "Footwear" && getItemStyleTags(item).includes("Formal")) score += 2.4;
    if (slot === "TopOuter" && hasType("blazer", "wool coat")) score += 6;
    if (item.garmentType === "Accessory" && item.accessorySlot === "LeftHand" && hasType("watch")) score += 1.5;
    if (item.garmentType === "Accessory" && item.accessorySlot === "Belt" && hasType("belt")) score += 1.2;
    if (slot === "Headwear" && hasType("hat")) score += 1.5;
    if (slot === "Headwear" && hasType("cap")) score -= 2.6;
    if (slot === "Bottom" && hasType("jeans")) score -= 2.5;
    if (slot === "TopInner" && hasType("t-shirt", "ls t-shirt")) score -= 2.4;
  }

  if (styleMode === "formal-bridge") {
    if (slot === "TopInner" && hasType("shirt")) score += 3.5;
    if (slot === "Bottom" && hasType("trousers", "light trousers", "heavy wool trousers")) score += 3.5;
    if (slot === "Footwear" && hasType("derby", "leather sneakers")) score += hasType("derby") ? 3.5 : 2.2;
    if (slot === "TopOuter" && hasType("blazer", "wool coat", "jacket", "wool jacket")) score += hasType("blazer", "wool coat") ? 3.5 : 2;
    if (slot === "Headwear" && hasType("hat")) score += 1.2;
    if (slot === "Bottom" && hasType("jeans")) score -= 1;
  }

  if (styleMode === "smart-casual") {
    if (slot === "TopInner" && hasType("shirt", "casual shirt", "knit", "knit sweater", "wool shirt", "fleece sweater")) score += hasType("shirt", "wool shirt") ? 4.8 : 3.8;
    if (slot === "Footwear" && hasType("leather sneakers", "boots", "derby")) score += hasType("leather sneakers") ? 4.2 : hasType("boots") ? 2.8 : 1.6;
    if (slot === "TopOuter" && hasType("jacket", "twill jacket", "blazer", "wool coat", "wool jacket")) score += hasType("blazer", "wool coat") ? 4.2 : 3.2;
    if (slot === "Headwear" && hasType("hat")) score += 1;
    if (slot === "Bottom" && hasType("trousers", "light trousers")) score += 3.5;
    if (slot === "Bottom" && hasType("jeans")) score += 1.2;
  }

  if (styleMode === "athleisure") {
    if (slot === "TopInner" && hasType("hoodie", "sweatshirt", "sport t-shirt", "sport ls t-shirt", "fleece sweater")) score += hasType("sport t-shirt", "sport ls t-shirt") ? 5 : 4.4;
    if (slot === "Footwear" && hasType("sneakers", "sneakers (thin)", "canvas sneakers")) score += 4.8;
    if (slot === "Headwear" && hasType("cap", "sport cap")) score += hasType("sport cap") ? 4.8 : 3.8;
    if (slot === "TopOuter" && hasType("shell jacket", "fleece jacket")) score += 4.4;
    if (slot === "Bottom" && hasType("sport shorts", "sport pants", "sweat pants", "shorts")) score += hasType("sport shorts", "sport pants") ? 4.8 : hasType("sweat pants") ? 4.2 : 1.8;
  }

  return score;
}

function getDominancePenaltyScore(item, pickedItems, styleMode, selectedStyles) {
  if (pickedItems.length < 2) return 0;

  const counts = new Map();
  pickedItems.forEach(picked => getItemStyleTags(picked).filter(style => selectedStyles.includes(style)).forEach(style => counts.set(style, (counts.get(style) ?? 0) + 1)));
  const dominantEntry = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!dominantEntry || dominantEntry[1] < 2) return 0;

  const [dominantStyle] = dominantEntry;
  const itemStyles = getItemStyleTags(item);

  if (dominantStyle === "Formal") {
    if (itemStyles.includes("Athleisure")) return -3.5;
    if (itemStyles.includes("Casual") && !itemStyles.includes("Formal") && !itemStyles.includes("Smart Casual")) return -2;
  }
  if (dominantStyle === "Athleisure" && itemStyles.includes("Formal")) return -3.5;
  if (dominantStyle === "Smart Casual" && isAthleisureOnlyItem(item)) return -2.5;
  return 0;
}

function getCrossStyleConflictScore(item, pickedItems, selectedStyles) {
  const itemStyles = getItemStyleTags(item);
  const selectedStyleSet = new Set(selectedStyles ?? []);

  if (!selectedStyleSet.has("Formal") || !selectedStyleSet.has("Athleisure")) {
    const pickedHasFormal = pickedItems.some((pickedItem) => getItemStyleTags(pickedItem).some(style => style === "Formal" && selectedStyleSet.has(style)));
    const pickedHasAthleisure = pickedItems.some((pickedItem) => getItemStyleTags(pickedItem).some(style => style === "Athleisure" && selectedStyleSet.has(style)));
    const itemIsFormal = itemStyles.includes("Formal");
    const itemIsAthleisure = itemStyles.includes("Athleisure");

    if ((pickedHasFormal && itemIsAthleisure) || (pickedHasAthleisure && itemIsFormal)) return -2.2;
  }

  return 0;
}

function getHotOuterwearScore(item, slot, climatePreferences) {
  if (climatePreferences.includes("Hot") && slot === "TopOuter" && item.garmentType === "Outerwear") {
    return normalizeWeight(item.weight) === "Heavy" ? -2 : -1.25;
  }
  return 0;
}

function getEarlyStyleAnchorScore(item, slot, pickedItems, selectedStyles) {
  if (pickedItems.length >= 2 || slot === "Headwear" || !selectedStyles.length) return 0;
  const types = getTypeMatchKeys(item.type);
  const hasType = (...values) => values.some(value => types.has(value));
  const smart = selectedStyles.includes("Formal") || selectedStyles.includes("Smart Casual");
  if (hasType("shirt")) return smart ? 2.2 : 1.3;
  if (hasType("hoodie", "sport t-shirt", "sport ls t-shirt", "sweatshirt")) return selectedStyles.includes("Athleisure") ? 2.2 : 1.3;
  if (hasType("trousers", "light trousers", "derby")) return smart ? 1.4 : 0.8;
  if (hasType("sport shorts", "shell jacket", "fleece jacket")) return selectedStyles.includes("Athleisure") ? 1.4 : 0.8;
  return 0;
}

function getRecentMemoryScore(item, slot, outfit, recentOutfits, layering, itemsById) {
  const normalizedRecentOutfits = normalizeRecentOutfits(recentOutfits);
  const scores = { recentItemPenalty: 0, recentExactPenalty: 0, recentLikedBoost: 0 };

  if (!normalizedRecentOutfits.length) return scores;

  const completedOutfit = { ...outfit, [slot]: item.id };
  const isComplete = getActiveOutfitSlots(layering).every((visibleSlot) => completedOutfit[visibleSlot]);

  normalizedRecentOutfits.forEach((recentOutfit, index) => {
    const itemPenalty = recentItemPenaltySteps[index] ?? 0;
    const slotPenalty = recentSlotPenaltySteps[index] ?? 0;
    const exactPenalty = recentExactPenaltySteps[index] ?? 0;
    const likedBoost = recentLikedBoostSteps[index] ?? 0;
    const itemUsed = visibleSlots.some((recentSlot) => recentOutfit.outfit?.[recentSlot] === item.id);
    if (itemUsed) {
      scores.recentItemPenalty -= itemPenalty;
      if (recentOutfit.outfit?.[slot] === item.id) {
        scores.recentItemPenalty -= slotPenalty;
      }
    }

    affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
      if (!recentOutfit.liked || ![sourceSlot, targetSlot].includes(slot)) return;
      const otherSlot = sourceSlot === slot ? targetSlot : sourceSlot;
      const otherId = outfit?.[otherSlot];
      if (!otherId) return;
      if (recentOutfit.outfit?.[otherSlot] === otherId && recentOutfit.outfit?.[slot] === item.id) {
        scores.recentLikedBoost += likedBoost;
      }
    });

    if (isComplete && recentOutfit.key === getOutfitKey(completedOutfit, layering)) {
      scores.recentExactPenalty -= exactPenalty;
    }
  });

  scores.recentItemPenalty = clampScore(scores.recentItemPenalty, MAX_RECENT_ITEM_PENALTY, 0);
  scores.recentExactPenalty = clampScore(scores.recentExactPenalty, MAX_RECENT_EXACT_PENALTY, 0);

  return scores;
}

function getStyleCoherenceScore(item, slot, selectedStyles, preferredStyles) {
  const itemStyles = getItemStyleTags(item);
  const isAthleisureOnly = itemStyles.length === 1 && itemStyles[0] === "Athleisure";
  const isFormalOnly = isFormalOnlyItem(item);
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const styleMode = resolveSelectedStyleMode(selectedStyles);

  if (!itemStyles.length) return 0;

  let score = 0;

  if (selectedStyles.length) {
    if (selectedStyles.some((style) => itemStyles.includes(style))) {
      score += styleMode === "casual" ? 4 : 6;
    } else {
      score -= isAthleisureOnly || isFormalOnly ? 5.5 : 3;
    }

    if ((styleMode === "formal" || styleMode === "formal-bridge") && hasType("t-shirt", "sport t-shirt", "ls t-shirt", "ls t-shirt (light)")) {
      score -= 4.8;
    }

    if (styleMode === "formal" && hasType("cap", "jeans")) {
      score -= hasType("cap") ? 2.6 : 2;
    }

    if (styleMode === "formal" && slot === "Footwear" && !itemStyles.includes("Formal")) {
      score -= hasType("leather sneakers") ? 5.4 : 6;
    }

    if (styleMode === "smart-casual" && hasType("sport t-shirt", "sport ls t-shirt", "sport shorts", "sport cap", "slides", "sandals", "fleece jacket", "shell jacket")) {
      score -= 4.5;
    }

    if (styleMode === "smart-casual" && hasType("hoodie", "sweatshirt")) {
      score -= 2.6;
    }

    if (styleMode === "athleisure") {
      if (hasType("wool shirt", "shirt", "blazer", "derby", "wool coat", "wool jacket")) {
        score -= 6;
      }
      if (itemStyles.every((style) => style === "Smart Casual" || style === "Formal")) {
        score -= 5.4;
      }
    }
  }

  if (preferredStyles.size) {
    const overlapCount = itemStyles.filter((style) => preferredStyles.has(style)).length;
    score += overlapCount * 2;
    if (!overlapCount && itemStyles.length) {
      score -= isAthleisureOnly && !preferredStyles.has("Athleisure") ? 3 : 1;
    }
  }

  return score;
}

function getAffinityScore(item, slot, outfit, outfitAffinity) {
  const affinity = normalizeAffinityMap(outfitAffinity);
  let score = 0;
  affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
    if (![sourceSlot, targetSlot].includes(slot)) return;
    const sourceId = sourceSlot === slot ? item.id : outfit[sourceSlot];
    const targetId = targetSlot === slot ? item.id : outfit[targetSlot];
    if (!sourceId || !targetId) return;
    const count = affinity[buildAffinityPairKey(sourceSlot, targetSlot, sourceId, targetId)] ?? 0;
    score += Math.min(count * 0.14, 0.35);
  });
  score += Math.min((affinity[buildAffinityItemKey(slot, item.id)] ?? 0) * 0.05, 0.2);
  return Math.min(score, MAX_AFFINITY_BOOST);
}

export function getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool = []) {
  outfit = getActiveOutfit({ ...outfit, [slot]: null }, layering);
  const pickedItems = getPickedOutfitItems({ ...outfit, Headwear: null }, itemsById);
  const selectedStyles = outfitFilters.style ?? [];
  const climate = getGenerationClimatePreferences(outfitFilters, weatherData);
  const styleMode = resolveSelectedStyleMode(selectedStyles);
  const breakdown = {
    favorite: item.favorite ? 0.5 : 0,
    affinity: getAffinityScore(item, slot, outfit, outfitAffinity),
    ...getRecentMemoryScore(item, slot, outfit, recentOutfits, layering, itemsById)
  };
  if (selectedStyles.length) {
    breakdown.styleCoherence = getStyleCoherenceScore(item, slot, selectedStyles, new Set(selectedStyles));
    breakdown.styleCompletion = getStyleCompletionScore(item, slot, styleMode);
    breakdown.dominance = getDominancePenaltyScore(item, pickedItems, styleMode, selectedStyles);
    breakdown.styleConflict = getCrossStyleConflictScore(item, pickedItems, selectedStyles);
    breakdown.earlyAnchor = getEarlyStyleAnchorScore(item, slot, pickedItems, selectedStyles);
    const bonus = styleMode === "formal" ? 2.8 : styleMode === "athleisure" ? 2.6 : styleMode === "smart-casual" ? 2.2 : 1.2;
    breakdown.selectedStyleBonus = ["TopInner", "TopMid", "TopOuter", "Bottom", "Footwear"].includes(slot) && getItemStyleTags(item).some(style => selectedStyles.includes(style)) ? bonus : 0;
  }
  if (climate.length) {
    breakdown.climate = getClimateScore(item, slot, climate);
    breakdown.hotOuterwear = getHotOuterwearScore(item, slot, climate);
    if (slot === "TopOuter") {
      if (climate.includes("Cold") || climate.includes("Snow")) breakdown.coldOuterwear = item.garmentType === "Outerwear" ? 3 : -4;
      if (climate.includes("Hot") && item.garmentType === "Outerwear") breakdown.hotOuterwear -= 3;
    }
  }
  const normalized = normalizeGuidedBreakdown(breakdown);
  const rawScore = GUIDED_BASE_SCORE + Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const score = Math.max(GUIDED_SCORE_FLOOR, rawScore);
  return { score, breakdown: { startingWeight: GUIDED_BASE_SCORE, ...normalized, ...(score > rawScore ? { minimumWeightAdjustment: score - rawScore } : {}) } };
}

function selectNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext = null) {
  if (!pool.length) return null;
  if (normalizeGenerationMode(generationMode) === "random") {
    const item = pickRandom(pool);
    return item ? { item, score: null, breakdown: null } : null;
  }

  const candidatePool = pool;

  const weightedCandidates = candidatePool.map((item) => {
    const result = getGuidedScoreBreakdown(
      item,
      slot,
      outfit,
      itemsById,
      outfitFilters,
      weatherData,
      outfitAffinity,
      recentOutfits,
      layering,
      candidatePool,
      generationContext
    );

    return {
      item,
      weight: result.score,
      score: result.score,
      breakdown: result.breakdown
    };
  });
  const pickedItem = pickWeightedRandom(weightedCandidates);
  if (!pickedItem) {
    return null;
  }

  const selectedEntry = weightedCandidates.find((entry) => entry.item.id === pickedItem.id) ?? null;
  const topCandidates = weightedCandidates.filter(entry => entry.item.id !== pickedItem.id)
    .sort((left, right) => right.score - left.score).slice(0, GUIDED_DEBUG_TOP_CANDIDATE_LIMIT)
    .map(entry => ({ itemId: entry.item.id, score: entry.score }));
  return selectedEntry
    ? {
        ...selectedEntry,
        topCandidates
      }
    : null;
}

export function pickNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext = null) {
  return selectNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext)?.item ?? null;
}

export function getGuidedBreakdownDisplayEntries(breakdown = {}, limit = 3) {
  return Object.entries(breakdown)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, limit)
    .map(([key, value]) => ({
      key,
      label: guidedExplanationLabels[key] ?? key,
      value
    }));
}

function summarizeGuidedReasonEntries(entries = []) {
  const aggregated = {};
  const seenKeys = new Set();

  entries.forEach((entry) => {
    Object.entries(entry.breakdown ?? {}).forEach(([key, value]) => {
      seenKeys.add(key);
      if (!value) return;
      const current = aggregated[key] ?? { total: 0, count: 0 };
      current.total += value;
      current.count += 1;
      aggregated[key] = current;
    });
  });

  const averagedEntries = Object.entries(aggregated)
    .map(([key, entry]) => [key, entry.total / entry.count])
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
  const thresholdedEntries = averagedEntries.filter(([, value]) => Math.abs(value) >= 0.2);
  const fallbackZeroEntries =
    !averagedEntries.length && seenKeys.size
      ? [...seenKeys].map((key) => [key, 0])
      : averagedEntries;
  const displayEntries = (thresholdedEntries.length ? thresholdedEntries : fallbackZeroEntries).slice(0, 6);

  return displayEntries.map(([key, value]) => ({
      key,
      label: guidedExplanationLabels[key] ?? key,
      value
    }));
}

export function isNonStackableTopType(item) {
  return (item.garmentType === "Top" || item.garmentType === "Outerwear") && nonStackableTopTypes.has(normalizeType(item.type));
}

export function getOtherTopSlot(slot) {
  if (slot === "TopInner") return "TopOuter";
  if (slot === "TopOuter") return "TopInner";
  return null;
}

export function filterPoolForLayeringRules(pool, slot, outfit, itemsById) {
  if (!topSlots.includes(slot)) return pool;
  const otherItems = topSlots.filter((otherSlot) => otherSlot !== slot)
    .map((otherSlot) => itemsById[outfit[otherSlot]]).filter(Boolean);
  return pool.filter((item) => otherItems.every((otherItem) => {
    if (otherItem.id === item.id) return false;
    if (isNonStackableTopType(otherItem) && normalizeType(item.type) === normalizeType(otherItem.type)) return false;
    if (isShirtLayeringType(otherItem) && isShirtLayeringType(item)) return false;
    return true;
  }));
}

function isHeavyOuterwear(item) {
  return item?.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy";
}

function isWarmWeatherConflictItem(item) {
  const type = normalizeType(item?.type);

  if (item?.garmentType === "Bottom") return type === "shorts";
  if (item?.garmentType === "Footwear") return ["slide", "slides", "sandal", "sandals"].includes(type);
  return false;
}

function isOutfitCompatible(outfit, itemsById) {
  const selectedItems = visibleSlots
    .map((slot) => itemsById[outfit[slot]])
    .filter(Boolean);

  return !selectedItems.some(isHeavyOuterwear) || !selectedItems.some(isWarmWeatherConflictItem);
}

export function filterPoolForCompatibilityRules(pool, slot, outfit, itemsById) {
  if (!pool.length) return pool;

  const filtered = pool.filter((item) =>
    isOutfitCompatible(
      {
        ...outfit,
        [slot]: item.id
      },
      itemsById
    )
  );

  return filtered;
}

function buildNextOutfitResult(
  items,
  currentOutfit,
  locked,
  layering,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = [],
  options = {}
) {
  const itemsById = options.itemsById ?? Object.fromEntries(items.map(item => [item.id, item]));
  const normalized = normalizeOutfitStructure(currentOutfit, locked, layering, itemsById);
  const nextOutfit = { ...normalized.outfit };
  locked = normalized.locked;
  const guidedDebugPayload = [];

  visibleSlots.forEach((slot) => {
    if (!locked[slot]) nextOutfit[slot] = null;
  });

  generationOrder.forEach((slot) => {
    if (slot === "TopMid" && layering !== 3) {
      delete nextOutfit.TopMid;
      return;
    }
    if (locked[slot]) {
      return;
    }

    if (!layering && slot === "TopOuter") {
      nextOutfit[slot] = null;
      return;
    }

    const pool = getEligibleSlotPool(items, slot, excluded, generationLists, layering, outfitFilters, weatherData, nextOutfit, itemsById);
    const selectionOutfit = { ...nextOutfit };
    const selection = selectNextItemForGeneration(pool, slot, nextOutfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering);
    nextOutfit[slot] = selection?.item?.id ?? null;

    if (options.includeGuidedDebug && normalizeGenerationMode(generationMode) === "guided" && selection?.item && selection?.breakdown) {
      guidedDebugPayload.push({
        slot,
        selectionOutfit,
        itemId: selection.item.id,
        breakdown: selection.breakdown,
        score: selection.score,
        topCandidates: selection.topCandidates ?? []
      });
    } else if (options.includeGuidedDebug && normalizeGenerationMode(generationMode) === "guided") {
      guidedDebugPayload.push({ slot, selectionOutfit, itemId: null, score: null, breakdown: {}, topCandidates: [], reason: "No eligible candidates under current filters and structural compatibility." });
    }
  });

  recordSelectionContext(guidedDebugPayload, { outfit: normalized.outfit, locked, layering, itemsById, items, outfitFilters, generationLists, excluded, generationMode, outfitAffinity, recentOutfits }, nextOutfit, true);
  return { outfit: nextOutfit, locked, guidedDebugPayload, issues: getStructuralIssues(nextOutfit, locked, layering, itemsById) };
}

export function buildNextOutfit(
  items,
  currentOutfit,
  locked,
  layering,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = [],
  options = {}
) {
  return buildNextOutfitResult(items, currentOutfit, locked, layering, excluded, generationLists, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, options).outfit;
}

export function buildNextOutfitWithDebug(
  items,
  currentOutfit,
  locked,
  layering,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = [],
  options = {}
) {
  return buildNextOutfitResult(
    items,
    currentOutfit,
    locked,
    layering,
    excluded,
    generationLists,
    outfitFilters,
    weatherData,
    generationMode,
    outfitAffinity,
    recentOutfits,
    {
      ...options,
      includeGuidedDebug: true
    }
  );
}

export function summarizeGuidedExplanation(outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering) {
  const contextOutfit = {};
  const breakdownEntries = [];

  generationOrder.filter(slot => getActiveOutfitSlots(layering).includes(slot)).forEach((slot) => {
    const itemId = outfit?.[slot];
    const item = itemId ? itemsById[itemId] : null;
    if (!item) return;

    const pool = getEligibleSlotPool(
      Object.values(itemsById),
      slot,
      {},
      defaultGenerationLists,
      layering,
      outfitFilters,
      weatherData,
      contextOutfit,
      itemsById
    );
    const { breakdown } = getGuidedScoreBreakdown(item, slot, contextOutfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool);
    breakdownEntries.push({ slot, itemId, breakdown });

    contextOutfit[slot] = itemId;
  });

  return summarizeGuidedReasonEntries(breakdownEntries);
}

export function summarizeGuidedDebugPayload(guidedDebugPayload = []) {
  return summarizeGuidedReasonEntries(guidedDebugPayload);
}

export function normalizeOutfitFilters(outfitFilters) {
  const normalizeOptionGroup = (group, options) => (
    Array.isArray(outfitFilters?.[group])
      ? outfitFilters[group].filter((value) => options.includes(value))
      : []
  );
  const normalizeCollectionsGroup = (group) => (
    Array.isArray(outfitFilters?.[group])
      ? [...new Set(outfitFilters[group].filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]
      : []
  );

  return {
    ...(["yes", "no"].includes(outfitFilters?.favorite) ? { favorite: outfitFilters.favorite } : {}),
    style: normalizeOptionGroup("style", styleTagOptions),
    styleExcluded: normalizeOptionGroup("styleExcluded", styleTagOptions),
    climate: normalizeOptionGroup("climate", climateTagOptions),
    climateExcluded: normalizeOptionGroup("climateExcluded", climateTagOptions),
    collections: normalizeCollectionsGroup("collections"),
    collectionsExcluded: normalizeCollectionsGroup("collectionsExcluded")
  };
}

export function normalizeLikedOutfitKeys(value) {
  const result = {};
  for (const key of Object.keys(normalizeBooleanLookup(value))) {
    let canonical = key;
    try {
      const parsed = JSON.parse(key);
      if (parsed && typeof parsed.slots === "object" && parsed.slots && Object.hasOwn(parsed, "layering")) canonical = getOutfitKey(parsed.slots, normalizeLayering(parsed.layering));
    } catch { /* Keep unknown legacy keys intact. */ }
    result[canonical] = true;
  }
  return result;
}

export function normalizeOutfitAffinity(value) {
  return normalizeAffinityMap(value);
}
