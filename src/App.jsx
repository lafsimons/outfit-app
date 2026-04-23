import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteItem,
  exportBackup,
  getDefaultData,
  loadAppState,
  loadItems,
  replaceWithBackup,
  resetToDefaults,
  saveAppState,
  saveItem
} from "./lib/storage";

const imageAssets = import.meta.glob("../images/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default"
});

const imageAssetEntries = Object.entries(imageAssets)
  .map(([path, imageUrl]) => {
    const filename = path.split("/").pop();

    return filename && !filename.startsWith(".")
      ? {
          filename,
          imageUrl
        }
      : null;
  })
  .filter(Boolean);
const imageUrlByFilename = Object.fromEntries(
  imageAssetEntries.map((image) => [image.filename, image.imageUrl])
);

function getImageFilename(imageUrl) {
  const pathname = imageUrl.split("?")[0].split("#")[0];
  const filename = pathname.split("/").pop() ?? "";

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

function stripViteHash(filename) {
  const extensionIndex = filename.lastIndexOf(".");

  if (extensionIndex === -1) {
    return filename;
  }

  const stem = filename.slice(0, extensionIndex);
  const extension = filename.slice(extensionIndex);
  const hashSeparatorIndex = stem.lastIndexOf("-");

  if (hashSeparatorIndex === -1) {
    return filename;
  }

  return `${stem.slice(0, hashSeparatorIndex)}${extension}`;
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl || imageUrl.startsWith("data:") || /^https?:\/\//.test(imageUrl)) {
    return imageUrl;
  }

  if (!imageUrl.startsWith("/images/") && !imageUrl.startsWith("/assets/")) {
    return imageUrl;
  }

  const filename = getImageFilename(imageUrl);
  return imageUrlByFilename[filename] ?? imageUrlByFilename[stripViteHash(filename)] ?? imageUrl;
}

const visibleSlots = ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"];
const garmentTypes = [
  "Headwear",
  "Top",
  "Bottom",
  "Footwear",
  "Dresses/Jumpsuits",
  "Accessory"
];
const layerTypes = ["Outer", "Inner", "Both"];
const accessorySlots = ["Glasses", "Neck", "LeftHand", "RightHand", "Bag", "Belt"];
const itemLists = ["Wardrobe", "Wishlist"];
const defaultGenerationLists = {
  Wardrobe: true,
  Wishlist: false
};
const styleTagOptions = ["Casual", "Formal", "Athleisure", "Going Out"];
const climateTagOptions = ["Cold", "Warm", "Hot", "Snow", "Rain", "Indoor", "Transitional"];
const outfitFilterOptions = {
  style: styleTagOptions,
  climate: climateTagOptions,
  color: ["Light", "Dark", "Monochrome", "Colorful"]
};
const defaultOutfitFilterRules = {
  style: {
    Casual: [
      "Cap",
      "Beanie",
      "Casual Shirt",
      "Shirt",
      "T-Shirt",
      "Knit",
      "Sweatshirt",
      "Hoodie",
      "Jacket",
      "Jeans",
      "Trousers",
      "Sneakers",
      "Sandals"
    ],
    Formal: ["Shirt", "Blazer", "Coat", "Trousers", "Derby"],
    Athleisure: ["Sneakers", "Hoodie", "Sweatshirt", "T-Shirt", "Jacket"],
    "Going Out": ["Shirt", "Blazer", "Jacket", "Coat", "Trousers", "Derby", "Jewelry", "Glasses"]
  },
  climateAllow: {
    Cold: ["Beanie", "Scarf", "Knit", "Sweatshirt", "Hoodie", "Jacket", "Coat", "Boots", "Trousers", "Jeans"],
    Warm: ["Cap", "Casual Shirt", "Shirt", "T-Shirt", "Shorts", "Trousers", "Jeans", "Sneakers", "Sandals"],
    Hot: ["Cap", "Casual Shirt", "Shirt", "T-Shirt", "Shorts", "Sneakers", "Sandals"],
    Snow: ["Beanie", "Scarf", "Knit", "Sweatshirt", "Hoodie", "Jacket", "Coat", "Boots", "Trousers", "Jeans"],
    Rain: ["Cap", "Jacket", "Coat", "Boots", "Trousers", "Jeans", "Sneakers"],
    Indoor: ["Casual Shirt", "Shirt", "T-Shirt", "Knit", "Sweatshirt", "Hoodie", "Jeans", "Trousers", "Shorts", "Sneakers", "Derby"],
    Transitional: ["Cap", "Casual Shirt", "Shirt", "T-Shirt", "Knit", "Jacket", "Blazer", "Trousers", "Jeans", "Sneakers", "Derby"]
  },
  climateBlock: {
    Cold: ["Shorts", "Sandals"],
    Warm: ["Beanie", "Scarf", "Coat", "Boots"],
    Hot: ["Beanie", "Scarf", "Knit", "Sweatshirt", "Hoodie", "Coat", "Boots"],
    Snow: ["Shorts", "Sandals"],
    Rain: ["Shorts", "Sandals"],
    Indoor: ["Coat", "Boots"],
    Transitional: ["Shorts", "Coat"]
  }
};
const emptyOutfitFilters = {
  style: [],
  climate: [],
  color: []
};
const emptyWardrobeFilters = {
  brand: "",
  type: "",
  garmentType: "",
  color: "",
  laundry: "",
  list: "",
  favorite: ""
};
const itemTypes = [
  "Beanie",
  "Cap",
  "Casual Shirt",
  "Shirt",
  "T-Shirt",
  "Knit",
  "Sweatshirt",
  "Hoodie",
  "Jacket",
  "Coat",
  "Blazer",
  "Vest",
  "Jeans",
  "Trousers",
  "Shorts",
  "Sneakers",
  "Sandals",
  "Boots",
  "Derby",
  "Dress",
  "Jumpsuit",
  "Bag",
  "Scarf",
  "Glasses",
  "Jewelry",
  "Belt",
  "Other"
];
const outfitLayout = ["Headwear", "TopGroup", "Bottom", "Footwear"];
const nonStackableTopTypes = new Set(["sweatshirt", "jacket"]);
const accessorySlotByItemType = {
  Bag: "Bag",
  Scarf: "Neck",
  Glasses: "Glasses",
  Jewelry: "LeftHand",
  Belt: "Belt"
};
const garmentTypeByItemType = {
  Beanie: "Headwear",
  Cap: "Headwear",
  "Casual Shirt": "Top",
  Shirt: "Top",
  "T-Shirt": "Top",
  Knit: "Top",
  Sweatshirt: "Top",
  Hoodie: "Top",
  Jacket: "Top",
  Coat: "Top",
  Blazer: "Top",
  Vest: "Top",
  Jeans: "Bottom",
  Trousers: "Bottom",
  Shorts: "Bottom",
  Sneakers: "Footwear",
  Sandals: "Footwear",
  Boots: "Footwear",
  Derby: "Footwear",
  Dress: "Dresses/Jumpsuits",
  Jumpsuit: "Dresses/Jumpsuits",
  Bag: "Accessory",
  Scarf: "Accessory",
  Glasses: "Accessory",
  Jewelry: "Accessory",
  Belt: "Accessory"
};
const layerTypeByItemType = {
  "Casual Shirt": "Inner",
  Shirt: "Inner",
  "T-Shirt": "Inner",
  Jacket: "Outer",
  Coat: "Outer",
  Blazer: "Outer",
  Sweatshirt: "Both",
  Knit: "Both",
  Hoodie: "Both",
  Vest: "Both"
};

const emptyForm = {
  id: "",
  name: "",
  imageUrl: "",
  imageScale: 100,
  imageOffsetX: 0,
  imageOffsetY: 0,
  value: "",
  retailValue: "",
  brand: "",
  type: "",
  size: "",
  favorite: false,
  garmentType: "Top",
  layerType: "Both",
  accessorySlot: "",
  color: "",
  list: "Wardrobe",
  quantity: 1,
  styleTags: [],
  climateTags: []
};

function normalizeList(list) {
  return itemLists.includes(list) ? list : "Wardrobe";
}

function isWishlistItem(item) {
  const searchableMetadata = `${item.id ?? ""} ${item.name ?? ""}`.toLowerCase();
  return normalizeList(item.list) === "Wishlist" || searchableMetadata.includes("wishlist");
}

function normalizeItemType(type) {
  return type === "Derbies" ? "Derby" : type;
}

function normalizeImageScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return Math.min(180, Math.max(50, Math.round(parsed)));
}

function normalizeImageOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(50, Math.max(-50, Math.round(parsed)));
}

function normalizeQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.round(parsed));
}

function normalizeTagList(value, options) {
  return Array.isArray(value)
    ? value.filter((tag, index) => options.includes(tag) && value.indexOf(tag) === index)
    : [];
}

function cloneOutfitFilterRules(rules = defaultOutfitFilterRules) {
  return {
    style: Object.fromEntries(styleTagOptions.map((style) => [style, [...(rules.style?.[style] ?? [])]])),
    climateAllow: Object.fromEntries(climateTagOptions.map((climate) => [climate, [...(rules.climateAllow?.[climate] ?? [])]])),
    climateBlock: Object.fromEntries(climateTagOptions.map((climate) => [climate, [...(rules.climateBlock?.[climate] ?? [])]]))
  };
}

function normalizeRuleTypeList(value) {
  const itemTypeByNormalized = Object.fromEntries(itemTypes.map((type) => [normalizeType(type), type]));
  const selected = Array.isArray(value) ? value : [];
  const normalized = selected
    .map((type) => itemTypeByNormalized[normalizeType(type)])
    .filter(Boolean);

  return [...new Set(normalized)];
}

function normalizeOutfitFilterRules(rules) {
  return {
    style: Object.fromEntries(
      styleTagOptions.map((style) => [
        style,
        normalizeRuleTypeList(rules?.style?.[style] ?? defaultOutfitFilterRules.style[style])
      ])
    ),
    climateAllow: Object.fromEntries(
      climateTagOptions.map((climate) => [
        climate,
        normalizeRuleTypeList(rules?.climateAllow?.[climate] ?? defaultOutfitFilterRules.climateAllow[climate])
      ])
    ),
    climateBlock: Object.fromEntries(
      climateTagOptions.map((climate) => [
        climate,
        normalizeRuleTypeList(rules?.climateBlock?.[climate] ?? defaultOutfitFilterRules.climateBlock[climate])
      ])
    )
  };
}

function getItemImageStyle(item) {
  const scale = normalizeImageScale(item?.imageScale);
  const offsetX = normalizeImageOffset(item?.imageOffsetX);
  const offsetY = normalizeImageOffset(item?.imageOffsetY);

  if (scale === 100 && offsetX === 0 && offsetY === 0) {
    return undefined;
  }

  return { transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale / 100})` };
}

function pickRandom(items) {
  if (!items.length) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function isEligibleForGeneration(item, excluded = {}, generationLists = defaultGenerationLists) {
  return !excluded[item.id] && generationLists[normalizeList(item.list)] !== false;
}

function getPool(items, slot, excluded = {}, generationLists = defaultGenerationLists, layering = true) {
  return items.filter((item) => {
    if (!isEligibleForGeneration(item, excluded, generationLists)) {
      return false;
    }

    if (slot === "Headwear") {
      return item.garmentType === "Headwear";
    }

    if (slot === "Bottom") {
      return item.garmentType === "Bottom";
    }

    if (slot === "Footwear") {
      return item.garmentType === "Footwear";
    }

    if (slot === "TopInner") {
      if (!layering) {
        return item.garmentType === "Top";
      }

      return item.garmentType === "Top" && (item.layerType === "Inner" || item.layerType === "Both");
    }

    if (slot === "TopOuter") {
      return item.garmentType === "Top" && (item.layerType === "Outer" || item.layerType === "Both");
    }

    if (accessorySlots.includes(slot)) {
      return item.garmentType === "Accessory" && item.accessorySlot === slot;
    }

    return false;
  });
}

function normalizeType(type) {
  return type?.trim().toLowerCase() ?? "";
}

const namedColorHex = {
  black: "#171717",
  gray: "#777777",
  grey: "#777777",
  charcoal: "#333333",
  sumi: "#363432",
  white: "#f1f0eb",
  beige: "#cbb995",
  cream: "#e8dcc5",
  brown: "#6d4a2f",
  indigo: "#263f6a",
  blue: "#3f6da8",
  navy: "#1e2e4d",
  red: "#a43d35",
  green: "#4d6f45",
  olive: "#6b7147",
  yellow: "#d7b44a",
  orange: "#c66d35",
  purple: "#6b4f8f",
  pink: "#c98098"
};

function ruleTypesInclude(types, type) {
  const normalizedType = normalizeType(type);
  return normalizeRuleTypeList(types).some((ruleType) => normalizeType(ruleType) === normalizedType);
}

function inferStyleTags(item, outfitFilterRules = defaultOutfitFilterRules) {
  return styleTagOptions.filter((style) => ruleTypesInclude(outfitFilterRules.style?.[style], item.type));
}

function inferClimateTags(item, outfitFilterRules = defaultOutfitFilterRules) {
  return climateTagOptions.filter((climate) => {
    if (ruleTypesInclude(outfitFilterRules.climateBlock?.[climate], item.type)) {
      return false;
    }

    return ruleTypesInclude(outfitFilterRules.climateAllow?.[climate], item.type);
  });
}

function getItemStyleTags(item, outfitFilterRules = defaultOutfitFilterRules) {
  return [...new Set([...inferStyleTags(item, outfitFilterRules), ...normalizeTagList(item.styleTags, styleTagOptions)])];
}

function getItemClimateTags(item, outfitFilterRules = defaultOutfitFilterRules) {
  return [...new Set([...inferClimateTags(item, outfitFilterRules), ...normalizeTagList(item.climateTags, climateTagOptions)])];
}

function hasActiveOutfitFilters(outfitFilters) {
  return Object.values(outfitFilters ?? {}).some((values) => Array.isArray(values) && values.length > 0);
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) {
    return null;
  }

  const value = Number.parseInt(clean, 16);
  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return { h: hue * 60, s: saturation, l: lightness };
}

function getColorRgb(item) {
  const color = normalizeType(item.color);
  if (!color) {
    return null;
  }

  const namedMatch = Object.entries(namedColorHex).find(([name]) => color.includes(name));
  return namedMatch ? hexToRgb(namedMatch[1]) : null;
}

function getColorProfile(item) {
  const rgb = getColorRgb(item);
  if (!rgb) {
    return null;
  }

  return rgbToHsl(rgb);
}

function matchesItemColorFilters(item, selectedColors) {
  if (!selectedColors?.length) {
    return true;
  }

  const profile = getColorProfile(item);
  if (!profile) {
    return true;
  }

  return selectedColors.some((filter) => {
    if (filter === "Light") {
      return profile.l >= 0.62;
    }

    if (filter === "Dark") {
      return profile.l <= 0.42;
    }

    if (filter === "Monochrome") {
      return profile.s <= 0.22;
    }

    if (filter === "Colorful") {
      return profile.s >= 0.34;
    }

    return true;
  });
}

function matchesOutfitFilters(
  item,
  outfitFilters = emptyOutfitFilters,
  outfitFilterRules = defaultOutfitFilterRules
) {
  const selectedStyles = outfitFilters.style ?? [];
  const selectedClimates = outfitFilters.climate ?? [];
  const selectedColors = outfitFilters.color ?? [];

  return (
    (!selectedStyles.length || selectedStyles.some((style) => getItemStyleTags(item, outfitFilterRules).includes(style))) &&
    (!selectedClimates.length || selectedClimates.some((climate) => getItemClimateTags(item, outfitFilterRules).includes(climate))) &&
    matchesItemColorFilters(item, selectedColors)
  );
}

function applyOutfitFiltersToPool(pool, outfitFilters, outfitFilterRules = defaultOutfitFilterRules) {
  if (!hasActiveOutfitFilters(outfitFilters)) {
    return pool;
  }

  const filtered = pool.filter((item) => matchesOutfitFilters(item, outfitFilters, outfitFilterRules));
  return filtered.length ? filtered : pool;
}

function isNonStackableTopType(item) {
  return item.garmentType === "Top" && nonStackableTopTypes.has(normalizeType(item.type));
}

function getOtherTopSlot(slot) {
  if (slot === "TopInner") {
    return "TopOuter";
  }

  if (slot === "TopOuter") {
    return "TopInner";
  }

  return null;
}

function filterPoolForLayeringRules(pool, slot, outfit, itemsById) {
  if (slot !== "TopInner" && slot !== "TopOuter") {
    return pool;
  }

  const otherTopSlot = getOtherTopSlot(slot);
  const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

  if (!otherItem || !isNonStackableTopType(otherItem)) {
    return pool;
  }

  const blockedType = normalizeType(otherItem.type);
  return pool.filter((item) => normalizeType(item.type) !== blockedType);
}

function buildNextOutfit(
  items,
  currentOutfit,
  locked,
  layering,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  outfitFilterRules = defaultOutfitFilterRules
) {
  const nextOutfit = { ...currentOutfit };
  let usedTopBoth = false;
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));

  visibleSlots.forEach((slot) => {
    if (locked[slot]) {
      if (slot === "TopInner" || slot === "TopOuter") {
        const lockedItem = itemsById[nextOutfit[slot]];
        if (lockedItem?.garmentType === "Top" && lockedItem.layerType === "Both") {
          usedTopBoth = true;
        }
      }
      return;
    }

    if (!layering && slot === "TopOuter") {
      nextOutfit[slot] = null;
      return;
    }

    let pool = getPool(items, slot, excluded, generationLists, layering);

    if (slot === "TopInner" || slot === "TopOuter") {
      if (layering && usedTopBoth) {
        pool = pool.filter((item) => item.layerType !== "Both");
      }

      if (layering) {
        pool = filterPoolForLayeringRules(pool, slot, nextOutfit, itemsById);
      }

      pool = applyOutfitFiltersToPool(pool, outfitFilters, outfitFilterRules);

      const nextItem = pickRandom(pool);
      nextOutfit[slot] = nextItem?.id ?? null;

      if (nextItem?.layerType === "Both") {
        usedTopBoth = true;
      }

      return;
    }

    nextOutfit[slot] = pickRandom(applyOutfitFiltersToPool(pool, outfitFilters, outfitFilterRules))?.id ?? null;
  });

  return nextOutfit;
}

function slugPart(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildBaseItemId(item) {
  const segments = [item.garmentType];

  if (item.garmentType === "Top") {
    segments.push(item.layerType);
  }

  if (item.garmentType === "Accessory" && item.accessorySlot) {
    segments.push(item.accessorySlot);
  }

  if (item.type) {
    segments.push(item.type);
  }

  if (item.brand) {
    segments.push(item.brand);
  }

  if (item.name) {
    segments.push(item.name);
  }

  if (item.size) {
    segments.push(item.size);
  }

  if (item.color) {
    segments.push(item.color);
  }

  return segments
    .map((segment) => slugPart(segment || ""))
    .filter(Boolean)
    .join("_");
}

function createUniqueItemId(item, items, currentId = null) {
  const baseId = buildBaseItemId(item) || "item";
  let candidateId = baseId;
  let counter = 2;

  while (items.some((existing) => existing.id === candidateId && existing.id !== currentId)) {
    candidateId = `${baseId}_${counter}`;
    counter += 1;
  }

  return candidateId;
}

function buildDisplayName(item) {
  const parts = [item.brand, item.name]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (parts.length) {
    return parts.join(" ");
  }

  return item.garmentType || "Untitled item";
}

function hasNamingMetadata(item) {
  return [item.name, item.brand, item.type, item.color].some((value) => value?.trim());
}

function getAccessoryLabel(slot) {
  const labels = {
    Glasses: "Glasses",
    Neck: "Neck",
    LeftHand: "Left hand",
    RightHand: "Right hand",
    Bag: "Bag",
    Belt: "Belt"
  };

  return labels[slot] ?? slot;
}

function getSlotLabel(slot) {
  const labels = {
    Headwear: "Headwear",
    TopInner: "Top",
    TopOuter: "Outer layer",
    Bottom: "Bottom",
    Footwear: "Footwear"
  };

  return labels[slot] ?? slot;
}

function hasAccessoryItems(outfit) {
  return accessorySlots.some((slot) => Boolean(outfit?.[slot]));
}

function getUniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function matchesWardrobeFilters(item, filters, ignoredKeys = []) {
  const ignored = new Set(ignoredKeys);

  return (
    (ignored.has("brand") || matchesMetadataFilter(item.brand, filters.brand)) &&
    (ignored.has("type") || matchesMetadataFilter(item.type, filters.type)) &&
    (ignored.has("garmentType") || matchesMetadataFilter(item.garmentType, filters.garmentType)) &&
    (ignored.has("color") || matchesMetadataFilter(item.color, filters.color)) &&
    (ignored.has("list") || !filters.list || normalizeList(item.list) === filters.list) &&
    (ignored.has("favorite") ||
      !filters.favorite ||
      (filters.favorite === "yes" ? Boolean(item.favorite) : !item.favorite))
  );
}

function matchesMetadataFilter(value, filterValue) {
  if (!filterValue) {
    return true;
  }

  if (filterValue === "__none__") {
    return !value;
  }

  return value === filterValue;
}

function getNumericValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const defaultMetadataCorrections = {
  headwear_cap_beige: {
    name: "R18C1 Shallow Cap Reed Linen",
    retailValue: "94",
    brand: "Man-tle",
    type: "Cap",
    size: "OS",
    garmentType: "Headwear",
    layerType: "Both",
    accessorySlot: "",
    color: "Beige",
    list: "Wardrobe"
  },
  top_shirt_111: {
    name: "Lot.111 Work Shirt",
    retailValue: "263",
    brand: "Taiga Takahashi",
    type: "Shirt",
    size: "16",
    garmentType: "Top",
    layerType: "Inner",
    accessorySlot: "",
    color: "Indigo",
    list: "Wardrobe"
  },
  top_jacket_303sumi: {
    name: "Lot.303 Coverall",
    retailValue: "316",
    brand: "Taiga Takahashi",
    type: "Jacket",
    size: "40",
    garmentType: "Top",
    layerType: "Outer",
    accessorySlot: "",
    color: "Sumi",
    list: "Wardrobe"
  },
  bottom_204_brown: {
    name: "Lot.204 Engineer Trousers",
    retailValue: "228",
    brand: "Taiga Takahashi",
    type: "Trousers",
    size: "34",
    garmentType: "Bottom",
    layerType: "Both",
    accessorySlot: "",
    color: "Brown",
    list: "Wardrobe"
  },
  footwear_sneaker_gat: {
    name: "GAT",
    retailValue: "30",
    brand: "Vintage",
    type: "Sneakers",
    size: "45",
    garmentType: "Footwear",
    layerType: "Both",
    accessorySlot: "",
    color: "White",
    list: "Wardrobe"
  }
};

const defaultMetadataCorrectionById = {
  headwear_cap_default_beige_os_beige: defaultMetadataCorrections.headwear_cap_beige,
  headwear_cap_man_tle_r18c1_shallow_cap_reed_linen_os_beige: defaultMetadataCorrections.headwear_cap_beige,
  top_inner_shirt_default_white_size_m: defaultMetadataCorrections.top_shirt_111,
  top_inner_shirt_taiga_takahashi_lot_111_work_shirt_16_indigo: defaultMetadataCorrections.top_shirt_111,
  top_outer_jacket_default_sumi_size_m: defaultMetadataCorrections.top_jacket_303sumi,
  top_outer_jacket_taiga_takahashi_lot_303_coverall_40_sumi: defaultMetadataCorrections.top_jacket_303sumi,
  bottom_trousers_default_brown_size_m: defaultMetadataCorrections.bottom_204_brown,
  bottom_trousers_brown_trousers_m_brown: defaultMetadataCorrections.bottom_204_brown,
  bottom_trousers_taiga_takahashi_lot_204_engineer_trousers_34_brown: defaultMetadataCorrections.bottom_204_brown,
  footwear_sneakers_default_gat_size_42: defaultMetadataCorrections.footwear_sneaker_gat,
  footwear_sneakers_vintage_gat_45_white: defaultMetadataCorrections.footwear_sneaker_gat
};

function getImageStem(imageUrl) {
  const filename = stripViteHash(getImageFilename(imageUrl));
  const extensionIndex = filename.lastIndexOf(".");
  return extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
}

function getDefaultMetadataCorrection(item) {
  return defaultMetadataCorrectionById[item.id] ?? defaultMetadataCorrections[getImageStem(item.imageUrl)];
}

function normalizeItem(item) {
  const value = item.value ?? "";
  const retailValue = item.retailValue ?? "";
  const shouldMoveValueToRetail = value !== "" && retailValue === "";
  const imageUrl = resolveImageUrl(item.imageUrl ?? item.img ?? "");
  const correction = getDefaultMetadataCorrection({ ...item, imageUrl });

  return {
    ...emptyForm,
    ...item,
    ...correction,
    value: shouldMoveValueToRetail ? "" : value,
    retailValue: shouldMoveValueToRetail ? value : correction?.retailValue ?? retailValue,
    imageUrl,
    imageScale: normalizeImageScale(item.imageScale),
    imageOffsetX: normalizeImageOffset(item.imageOffsetX),
    imageOffsetY: normalizeImageOffset(item.imageOffsetY),
    favorite: Boolean(item.favorite),
    quantity: normalizeQuantity(item.quantity),
    styleTags: normalizeTagList(item.styleTags, styleTagOptions),
    climateTags: normalizeTagList(item.climateTags, climateTagOptions),
    type: normalizeItemType(correction?.type ?? item.type ?? ""),
    list: normalizeList(correction?.list ?? item.list)
  };
}

function itemNeedsRetailMigration(originalItem, normalizedItem) {
  return originalItem.value !== "" && originalItem.value !== undefined && !originalItem.retailValue && normalizedItem.retailValue === originalItem.value;
}

function itemNeedsImageScaleMigration(originalItem, normalizedItem) {
  return originalItem.imageScale === undefined || normalizeImageScale(originalItem.imageScale) !== normalizedItem.imageScale;
}

function itemNeedsImageOffsetMigration(originalItem, normalizedItem) {
  return (
    originalItem.imageOffsetX === undefined ||
    originalItem.imageOffsetY === undefined ||
    normalizeImageOffset(originalItem.imageOffsetX) !== normalizedItem.imageOffsetX ||
    normalizeImageOffset(originalItem.imageOffsetY) !== normalizedItem.imageOffsetY
  );
}

function itemNeedsFavoriteMigration(originalItem, normalizedItem) {
  return originalItem.favorite === undefined && normalizedItem.favorite === false;
}

function itemNeedsQuantityMigration(originalItem, normalizedItem) {
  return originalItem.quantity === undefined || normalizeQuantity(originalItem.quantity) !== normalizedItem.quantity;
}

function itemNeedsTagMigration(originalItem, normalizedItem) {
  return (
    !Array.isArray(originalItem.styleTags) ||
    !Array.isArray(originalItem.climateTags) ||
    normalizeTagList(originalItem.styleTags, styleTagOptions).length !== normalizedItem.styleTags.length ||
    normalizeTagList(originalItem.climateTags, climateTagOptions).length !== normalizedItem.climateTags.length
  );
}

function itemNeedsDefaultMetadataMigration(originalItem, normalizedItem) {
  const correction = getDefaultMetadataCorrection(normalizedItem);

  if (!correction) {
    return false;
  }

  return Object.entries(correction).some(([key, value]) => originalItem[key] !== value);
}

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined) {
    return "No value";
  }

  return `${new Intl.NumberFormat("de-DE").format(getNumericValue(value))} €`;
}

function createSavedOutfitName(savedOutfits) {
  return `Outfit ${savedOutfits.length + 1}`;
}

function normalizeSavedOutfit(savedOutfit) {
  return {
    id: savedOutfit.id,
    name: savedOutfit.name ?? "Saved outfit",
    description: savedOutfit.description ?? "",
    outfit: savedOutfit.outfit ?? {},
    layering: Boolean(savedOutfit.layering)
  };
}

function getSavedOutfitPreviewSlots(savedOutfit) {
  return savedOutfit.layering
    ? ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"]
    : ["Headwear", "TopInner", "Bottom", "Footwear"];
}

function sanitizeOutfitForExistingItems(outfit, itemsById) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId && itemsById[itemId] ? itemId : null
    ])
  );
}

function savedOutfitHasMissingItems(savedOutfit, itemsById) {
  return Object.values(savedOutfit.outfit ?? {}).some((itemId) => itemId && !itemsById[itemId]);
}

function replaceItemIdInOutfit(outfit, oldItemId, newItemId) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId === oldItemId ? newItemId : itemId
    ])
  );
}

function clearItemIdFromOutfit(outfit, itemIdToClear) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId === itemIdToClear ? null : itemId
    ])
  );
}

function normalizeGenerationLists(generationLists) {
  return {
    ...defaultGenerationLists,
    ...(generationLists ?? {})
  };
}

function normalizeOutfitFilters(outfitFilters) {
  return Object.fromEntries(
    Object.entries(outfitFilterOptions).map(([group, options]) => [
      group,
      Array.isArray(outfitFilters?.[group])
        ? outfitFilters[group].filter((value) => options.includes(value))
        : []
    ])
  );
}

function buildWardrobeDescription(item) {
  const parts = [item.garmentType];
  const accessoryLabel = item.accessorySlot ? getAccessoryLabel(item.accessorySlot) : "";
  const normalizedTypeLabel = item.type?.trim() ?? "";

  if (normalizedTypeLabel) {
    parts.push(normalizedTypeLabel);
  }

  if (item.garmentType === "Top") {
    parts.push(item.layerType);
  }

  if (
    item.garmentType === "Accessory" &&
    accessoryLabel &&
    accessoryLabel.toLowerCase() !== normalizedTypeLabel.toLowerCase()
  ) {
    parts.push(accessoryLabel);
  }

  if (item.size) {
    parts.push(item.size);
  }

  return parts.filter(Boolean).join(" · ");
}

function getWorthCategory(item) {
  if (item.garmentType === "Top") {
    return "Tops";
  }

  if (item.garmentType === "Bottom") {
    return "Pants";
  }

  if (item.garmentType === "Footwear") {
    return "Shoes";
  }

  return "Accessories";
}

function createFitpicId() {
  return `fitpic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = dataUrl;
  });
}

function getFallbackPaletteColor(item) {
  const rgb = getColorRgb(item);
  return rgb ? rgbToHex(rgb) : "#8c8c8c";
}

function extractDominantColorsFromImage(image, maxColors = 3) {
  const sampleSize = 96;
  const scale = Math.min(1, sampleSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return [];
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const buckets = new Map();

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3];
    if (alpha < 96) {
      continue;
    }

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const brightness = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);

    if (brightness > 238 && spread < 18) {
      continue;
    }

    const key = [r, g, b].map((value) => Math.round(value / 32) * 32).join(",");
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((bucket) =>
      rgbToHex({
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count
      })
    );
}

async function extractItemPalette(item) {
  try {
    const image = await loadImage(resolveImageUrl(item.imageUrl));
    const colors = extractDominantColorsFromImage(image);
    return colors.length ? colors : [getFallbackPaletteColor(item)];
  } catch {
    return [getFallbackPaletteColor(item)];
  }
}

function mergePaletteColors(itemPalettes, maxColors = 7) {
  const colors = itemPalettes.flatMap(({ item, colors }) =>
    colors.map((color) => ({ color, label: buildDisplayName(item) }))
  );
  const merged = [];

  colors.forEach((entry) => {
    if (!merged.some((existing) => existing.color.toLowerCase() === entry.color.toLowerCase())) {
      merged.push(entry);
    }
  });

  return merged.slice(0, maxColors);
}

function canvasToDataUrl(canvas, type, quality) {
  const dataUrl = canvas.toDataURL(type, quality);
  return dataUrl.startsWith(`data:${type}`) ? dataUrl : "";
}

function isLocalDataImage(imageUrl) {
  return imageUrl.trim().startsWith("data:image/");
}

async function compressImageSource(source, maxDimension = 1400, quality = 0.86) {
  if (!source.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  const dataUrl = await readFileAsDataUrl(source);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image could not be processed.");
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvasToDataUrl(canvas, "image/webp", quality) || canvas.toDataURL("image/png");
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function getRemoveBackgroundExport(module) {
  const removeBackground = module.removeBackground ?? module.default;

  if (typeof removeBackground !== "function") {
    throw new Error("Background removal module did not load correctly.");
  }

  return removeBackground;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function validateBackup(backup) {
  return (
    backup &&
    backup.source === "outfit-app" &&
    backup.version === 1 &&
    Array.isArray(backup.items) &&
    backup.appState &&
    typeof backup.appState === "object" &&
    !Array.isArray(backup.appState)
  );
}

export default function App() {
  const editorRef = useRef(null);
  const importBackupRef = useRef(null);
  const outfitStageRef = useRef(null);
  const pickerOverlayRef = useRef(null);
  const paletteCacheRef = useRef(new Map());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [layering, setLayering] = useState(false);
  const [accessoriesEnabled, setAccessoriesEnabled] = useState(true);
  const [locked, setLocked] = useState({});
  const [excluded, setExcluded] = useState({});
  const [outfit, setOutfit] = useState({});
  const [ignoredImportImages, setIgnoredImportImages] = useState([]);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [fitpics, setFitpics] = useState([]);
  const [generationLists, setGenerationLists] = useState(defaultGenerationLists);
  const [outfitFilters, setOutfitFilters] = useState(emptyOutfitFilters);
  const [outfitFilterRules, setOutfitFilterRules] = useState(() => cloneOutfitFilterRules());
  const [controlsOpen, setControlsOpen] = useState(false);
  const [outfitFiltersOpen, setOutfitFiltersOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [editingSavedOutfitId, setEditingSavedOutfitId] = useState(null);
  const [savedOutfitDraft, setSavedOutfitDraft] = useState({ name: "", description: "" });
  const [activeAccessorySlot, setActiveAccessorySlot] = useState(null);
  const [activeOutfitSlot, setActiveOutfitSlot] = useState(null);
  const [pickerAnchorSlot, setPickerAnchorSlot] = useState(null);
  const [fitpicPreview, setFitpicPreview] = useState(null);
  const [wardrobeFiltersOpen, setWardrobeFiltersOpen] = useState(false);
  const [wardrobeWorthOpen, setWardrobeWorthOpen] = useState(false);
  const [wardrobeSavedOpen, setWardrobeSavedOpen] = useState(false);
  const [wardrobeManageOpen, setWardrobeManageOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editorFloatingOpen, setEditorFloatingOpen] = useState(false);
  const [editorReturnTarget, setEditorReturnTarget] = useState(null);
  const [draft, setDraft] = useState(emptyForm);
  const [imageUploadError, setImageUploadError] = useState("");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [wardrobeFilters, setWardrobeFilters] = useState(emptyWardrobeFilters);
  const [wardrobeSort, setWardrobeSort] = useState("");
  const [outfitPalette, setOutfitPalette] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items]
  );
  const currentOutfitItems = useMemo(() => {
    const slots = accessoriesEnabled ? [...visibleSlots, ...accessorySlots] : visibleSlots;
    const seen = new Set();

    return slots
      .map((slot) => itemsById[outfit[slot]])
      .filter((item) => {
        if (!item || seen.has(item.id)) {
          return false;
        }

        seen.add(item.id);
        return true;
      });
  }, [accessoriesEnabled, itemsById, outfit]);
  const compatibleAccessoryOptions = useMemo(() => {
    if (!activeAccessorySlot) {
      return [];
    }

    return getAccessoryOptions(activeAccessorySlot);
  }, [activeAccessorySlot, items, excluded, generationLists]);
  const generatedIdPreview = useMemo(
    () =>
      hasNamingMetadata(draft)
        ? buildBaseItemId({
            garmentType: draft.garmentType,
            layerType: draft.layerType,
            accessorySlot: draft.accessorySlot,
            type: draft.type,
            brand: draft.brand,
            name: draft.name,
            size: draft.size,
            color: draft.color,
            list: draft.list
          })
        : "",
    [draft]
  );
  const wardrobeFilterOptions = useMemo(
    () => {
      const typeItems = items.filter((item) =>
        matchesWardrobeFilters(item, wardrobeFilters, ["type"])
      );
      const brandItems = items.filter((item) =>
        matchesWardrobeFilters(item, wardrobeFilters, ["brand"])
      );
      const colorItems = items.filter((item) =>
        matchesWardrobeFilters(item, wardrobeFilters, ["color"])
      );

      return {
        brand: getUniqueValues(brandItems, "brand"),
        type: getUniqueValues(typeItems, "type"),
        garmentType: getUniqueValues(items, "garmentType"),
        color: getUniqueValues(colorItems, "color")
      };
    },
    [items, wardrobeFilters]
  );
  const canRemoveDraftBackground = isLocalDataImage(draft.imageUrl);
  const activeWardrobeFilterCount = Object.values(wardrobeFilters).filter(Boolean).length;
  const hasActiveWardrobeFilters = activeWardrobeFilterCount > 0;
  const activeWardrobeFilterChips = [
    ["Brand", wardrobeFilters.brand],
    ["Type", wardrobeFilters.type],
    ["Garment", wardrobeFilters.garmentType],
    ["Color", wardrobeFilters.color],
    ["List", wardrobeFilters.list],
    ["Exclude", wardrobeFilters.laundry],
    ["Favorite", wardrobeFilters.favorite]
  ]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({
      label,
      value:
        value === "__none__"
          ? `No ${label.toLowerCase()}`
          : label === "Favorite"
            ? value === "yes"
              ? "Yes"
              : "No"
            : label === "Exclude"
              ? value === "show"
                ? "Show excluded"
                : "Hide excluded"
            : value
    }));

  useEffect(() => {
    if (!wardrobeFilters.type || wardrobeFilters.type === "__none__") {
      return;
    }

    if (wardrobeFilterOptions.type.includes(wardrobeFilters.type)) {
      return;
    }

    setWardrobeFilters((current) => ({ ...current, type: "" }));
  }, [wardrobeFilterOptions.type, wardrobeFilters.type]);

  function requestConfirmation({ title, message, confirmLabel = "Confirm" }) {
    return new Promise((resolve) => {
      setConfirmation({
        title,
        message,
        confirmLabel,
        onCancel: () => {
          setConfirmation(null);
          resolve(false);
        },
        onConfirm: () => {
          setConfirmation(null);
          resolve(true);
        }
      });
    });
  }
  const visibleWardrobeItems = useMemo(() => {
    const filtered = items.filter((item) =>
      matchesWardrobeFilters(item, wardrobeFilters) &&
      (!wardrobeFilters.laundry ||
        (wardrobeFilters.laundry === "show" ? Boolean(excluded[item.id]) : !excluded[item.id]))
    );

    return filtered
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        if (wardrobeSort === "garmentType") {
          return a.item.garmentType.localeCompare(b.item.garmentType) || a.index - b.index;
        }

        if (wardrobeSort === "brand") {
          return (a.item.brand || "").localeCompare(b.item.brand || "") || a.index - b.index;
        }

        if (wardrobeSort === "type") {
          return (a.item.type || "").localeCompare(b.item.type || "") || a.index - b.index;
        }

        if (wardrobeSort === "value" || wardrobeSort === "paidHigh") {
          return getNumericValue(b.item.value) - getNumericValue(a.item.value) || a.index - b.index;
        }

        if (wardrobeSort === "paidLow") {
          return getNumericValue(a.item.value) - getNumericValue(b.item.value) || a.index - b.index;
        }

        if (wardrobeSort === "retailHigh") {
          return getNumericValue(b.item.retailValue) - getNumericValue(a.item.retailValue) || a.index - b.index;
        }

        if (wardrobeSort === "retailLow") {
          return getNumericValue(a.item.retailValue) - getNumericValue(b.item.retailValue) || a.index - b.index;
        }

        if (wardrobeSort === "newest") {
          return b.index - a.index;
        }

        if (wardrobeSort === "oldest") {
          return a.index - b.index;
        }

        if (wardrobeSort === "color") {
          return (a.item.color || "").localeCompare(b.item.color || "") || a.index - b.index;
        }

        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [items, wardrobeFilters, wardrobeSort, excluded]);

  const wardrobeWorth = useMemo(() => {
    const categories = ["Tops", "Pants", "Shoes", "Accessories"];
    const byCategory = Object.fromEntries(
      categories.map((category) => [category, { category, count: 0, value: 0, retailValue: 0 }])
    );

    items
      .filter((item) => !isWishlistItem(item))
      .forEach((item) => {
        const category = getWorthCategory(item);
        const quantity = normalizeQuantity(item.quantity);
        byCategory[category].count += quantity;
        byCategory[category].value += getNumericValue(item.value) * quantity;
        byCategory[category].retailValue += getNumericValue(item.retailValue) * quantity;
      });

    const rows = categories.map((category) => byCategory[category]);
    const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
    const totalRetailValue = rows.reduce((sum, row) => sum + row.retailValue, 0);
    const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
    const maxValue = Math.max(...rows.flatMap((row) => [row.value, row.retailValue]), 1);

    return { rows, totalValue, totalRetailValue, totalCount, maxValue };
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    async function updateOutfitPalette() {
      if (!currentOutfitItems.length) {
        setOutfitPalette([]);
        return;
      }

      const itemPalettes = await Promise.all(
        currentOutfitItems.map(async (item) => {
          const cacheKey = `${item.id}:${item.imageUrl}:${item.color}`;
          if (!paletteCacheRef.current.has(cacheKey)) {
            paletteCacheRef.current.set(cacheKey, await extractItemPalette(item));
          }

          return {
            item,
            colors: paletteCacheRef.current.get(cacheKey)
          };
        })
      );

      if (!cancelled) {
        setOutfitPalette(mergePaletteColors(itemPalettes));
      }
    }

    updateOutfitPalette();

    return () => {
      cancelled = true;
    };
  }, [currentOutfitItems]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [storedItems, storedAppState] = await Promise.all([loadItems(), loadAppState()]);
      const normalizedItems = storedItems.map(normalizeItem);
      const migratedItems = normalizedItems.filter(
        (item, index) =>
          itemNeedsRetailMigration(storedItems[index], item) ||
          itemNeedsImageScaleMigration(storedItems[index], item) ||
          itemNeedsImageOffsetMigration(storedItems[index], item) ||
          itemNeedsFavoriteMigration(storedItems[index], item) ||
          itemNeedsQuantityMigration(storedItems[index], item) ||
          itemNeedsTagMigration(storedItems[index], item) ||
          itemNeedsDefaultMetadataMigration(storedItems[index], item)
      );

      if (cancelled) {
        return;
      }

      if (migratedItems.length) {
        await Promise.all(migratedItems.map((item) => saveItem(item)));
      }

      setItems(normalizedItems);

      if (storedAppState) {
        setLayering(Boolean(storedAppState.layering));
        setAccessoriesEnabled(storedAppState.accessoriesEnabled ?? true);
        setLocked(storedAppState.locked ?? {});
        setExcluded(storedAppState.excluded ?? {});
        setOutfit(storedAppState.outfit ?? {});
        setIgnoredImportImages(storedAppState.ignoredImportImages ?? []);
        setSavedOutfits((storedAppState.savedOutfits ?? []).map(normalizeSavedOutfit));
        setGenerationLists(normalizeGenerationLists(storedAppState.generationLists));
        setOutfitFilters(normalizeOutfitFilters(storedAppState.outfitFilters));
        setOutfitFilterRules(normalizeOutfitFilterRules(storedAppState.outfitFilterRules));
        setFitpics(storedAppState.fitpics ?? []);
      } else {
        const defaultData = getDefaultData();
        const defaultState = defaultData.appState;
        setLayering(Boolean(defaultState.layering));
        setAccessoriesEnabled(defaultState.accessoriesEnabled ?? true);
        setLocked(defaultState.locked ?? {});
        setExcluded(defaultState.excluded ?? {});
        setOutfit(defaultState.outfit ?? buildNextOutfit(normalizedItems, {}, {}, false, {}, defaultGenerationLists, emptyOutfitFilters, defaultOutfitFilterRules));
        setIgnoredImportImages(defaultState.ignoredImportImages ?? []);
        setSavedOutfits((defaultState.savedOutfits ?? []).map(normalizeSavedOutfit));
        setGenerationLists(normalizeGenerationLists(defaultState.generationLists));
        setOutfitFilters(normalizeOutfitFilters(defaultState.outfitFilters));
        setOutfitFilterRules(normalizeOutfitFilterRules(defaultState.outfitFilterRules));
        setFitpics(defaultState.fitpics ?? []);
      }

      setLoading(false);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    saveAppState({
      layering,
      accessoriesEnabled,
      locked,
      excluded,
      outfit,
      ignoredImportImages,
      savedOutfits,
      generationLists,
      outfitFilters,
      outfitFilterRules,
      fitpics
    });
  }, [layering, accessoriesEnabled, locked, excluded, outfit, ignoredImportImages, savedOutfits, generationLists, outfitFilters, outfitFilterRules, fitpics, loading]);

  useEffect(() => {
    if (loading || !items.length) {
      return;
    }

    setOutfit((current) => {
      const missingEquipped = Object.values(current).some(
        (itemId) => itemId && !itemsById[itemId]
      );

      if (!missingEquipped) {
        return current;
      }

      const sanitized = { ...current };

      Object.entries(sanitized).forEach(([slot, itemId]) => {
        if (itemId && !itemsById[itemId]) {
          sanitized[slot] = null;
        }
      });

      return buildNextOutfit(items, sanitized, locked, layering, excluded, generationLists, outfitFilters, outfitFilterRules);
    });
  }, [items, itemsById, locked, layering, excluded, generationLists, outfitFilters, outfitFilterRules, loading]);

  useEffect(() => {
    if (!activeOutfitSlot && !activeAccessorySlot) {
      return undefined;
    }

    function handleDocumentPointerDown(event) {
      if (pickerOverlayRef.current?.contains(event.target)) {
        return;
      }

      closePickerOverlay();
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  }, [activeOutfitSlot, activeAccessorySlot]);

  useEffect(() => {
    function handleDocumentKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }

      if (confirmation) {
        event.preventDefault();
        confirmation.onCancel();
        return;
      }

      if (fitpicPreview) {
        event.preventDefault();
        setFitpicPreview(null);
        return;
      }

      if (editorFloatingOpen && editingId) {
        event.preventDefault();
        cancelEdit();
        return;
      }

      if (activeOutfitSlot || activeAccessorySlot) {
        event.preventDefault();
        closePickerOverlay();
        return;
      }

      if (wardrobeFiltersOpen) {
        event.preventDefault();
        setWardrobeFiltersOpen(false);
        return;
      }

      if (wardrobeWorthOpen) {
        event.preventDefault();
        setWardrobeWorthOpen(false);
        return;
      }

      if (wardrobeSavedOpen) {
        event.preventDefault();
        setWardrobeSavedOpen(false);
        return;
      }

      if (wardrobeManageOpen) {
        event.preventDefault();
        setWardrobeManageOpen(false);
        return;
      }

      if (activePanel) {
        event.preventDefault();
        closeWorkspacePanel();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [
    activeAccessorySlot,
    activeOutfitSlot,
    activePanel,
    confirmation,
    editingId,
    editorFloatingOpen,
    fitpicPreview,
    wardrobeFiltersOpen,
    wardrobeWorthOpen,
    wardrobeSavedOpen,
    wardrobeManageOpen
  ]);

  function handleGenerate() {
    setActivePanel(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setFitpicPreview(null);
    setEditorFloatingOpen(false);
    setEditingId(null);
    setEditorReturnTarget(null);
    setOutfit((current) => buildNextOutfit(items, current, locked, layering, excluded, generationLists, outfitFilters, outfitFilterRules));
  }

  function handleReroll(slot) {
    if (locked[slot]) {
      return;
    }

    const pool = getSlotOptions(slot).filter((item) => item.id !== outfit[slot]);

    const nextItem = pickRandom(pool);

    setOutfit((current) => ({
      ...current,
      [slot]: nextItem?.id ?? null
    }));
  }

  function getSlotOptions(slot) {
    let pool = getPool(items, slot, excluded, generationLists, layering);

    if (layering && (slot === "TopInner" || slot === "TopOuter")) {
      const otherTopSlot = getOtherTopSlot(slot);
      const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

      if (otherItem?.layerType === "Both") {
        pool = pool.filter((item) => item.layerType !== "Both");
      }

      pool = filterPoolForLayeringRules(pool, slot, outfit, itemsById);
    }

    return applyOutfitFiltersToPool(pool, outfitFilters, outfitFilterRules);
  }

  function getSlotPickerOptions(slot) {
    let pool = getPool(items, slot, {}, generationLists, layering);

    if (layering && (slot === "TopInner" || slot === "TopOuter")) {
      const otherTopSlot = getOtherTopSlot(slot);
      const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

      if (otherItem?.layerType === "Both") {
        pool = pool.filter((item) => item.layerType !== "Both");
      }

      pool = filterPoolForLayeringRules(pool, slot, outfit, itemsById);
    }

    return pool;
  }

  function getAccessoryOptions(slot) {
    return items.filter(
      (item) =>
        item.garmentType === "Accessory" &&
        item.accessorySlot === slot &&
        isEligibleForGeneration(item, excluded, generationLists)
    );
  }

  function setOutfitSlot(slot, itemId) {
    setOutfit((current) => ({
      ...current,
      [slot]: itemId
    }));
  }

  function removeOutfitSlot(slot) {
    setOutfitSlot(slot, null);
  }

  function cycleOutfitSlot(slot, direction) {
    const options = getSlotOptions(slot);

    if (!options.length) {
      setOutfitSlot(slot, null);
      return;
    }

    const currentIndex = options.findIndex((item) => item.id === outfit[slot]);
    const fallbackIndex = direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex + direction + options.length) % options.length;

    setOutfitSlot(slot, options[nextIndex].id);
  }

  function cycleAccessorySlot(slot, direction) {
    const options = getAccessoryOptions(slot);

    if (!options.length) {
      removeAccessoryFromSlot(slot);
      return;
    }

    const currentIndex = options.findIndex((item) => item.id === outfit[slot]);
    const fallbackIndex = direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex + direction + options.length) % options.length;

    setOutfit((current) => ({
      ...current,
      [slot]: options[nextIndex].id
    }));
  }

  function toggleLayering() {
    setLayering((current) => {
      const nextValue = !current;

      setOutfit((previous) => transitionLayering(previous, current, nextValue));

      return nextValue;
    });
  }

  function transitionLayering(previous, currentLayering, nextLayering) {
    const nextOutfit = { ...previous };

    if (!currentLayering && nextLayering) {
      const visibleTop = itemsById[nextOutfit.TopInner];

      if (visibleTop?.layerType === "Outer") {
        nextOutfit.TopOuter = nextOutfit.TopOuter || nextOutfit.TopInner;
        nextOutfit.TopInner = null;
      }

      if (nextOutfit.TopInner && nextOutfit.TopOuter === nextOutfit.TopInner) {
        nextOutfit.TopOuter = null;
      }

      if (!nextOutfit.TopInner) {
        nextOutfit.TopInner = pickRandom(getSlotOptionsForOutfit("TopInner", nextOutfit))?.id ?? null;
      }

      if (!nextOutfit.TopOuter) {
        nextOutfit.TopOuter = pickRandom(getSlotOptionsForOutfit("TopOuter", nextOutfit))?.id ?? null;
      }

      return nextOutfit;
    }

    if (currentLayering && !nextLayering && !nextOutfit.TopInner && nextOutfit.TopOuter) {
      nextOutfit.TopInner = nextOutfit.TopOuter;
    }

    return nextOutfit;
  }

  function applyLoadedData(nextItems, nextAppState) {
    const normalizedItems = nextItems.map(normalizeItem);
    const migratedItems = normalizedItems.filter(
      (item, index) =>
        itemNeedsRetailMigration(nextItems[index], item) ||
        itemNeedsImageScaleMigration(nextItems[index], item) ||
        itemNeedsImageOffsetMigration(nextItems[index], item) ||
        itemNeedsFavoriteMigration(nextItems[index], item) ||
        itemNeedsQuantityMigration(nextItems[index], item) ||
        itemNeedsTagMigration(nextItems[index], item) ||
        itemNeedsDefaultMetadataMigration(nextItems[index], item)
    );

    if (migratedItems.length) {
      Promise.all(migratedItems.map((item) => saveItem(item)));
    }

    setItems(normalizedItems);
    setLayering(Boolean(nextAppState?.layering));
    setAccessoriesEnabled(nextAppState?.accessoriesEnabled ?? true);
    setLocked(nextAppState?.locked ?? {});
    setExcluded(nextAppState?.excluded ?? {});
    setOutfit(nextAppState?.outfit ?? buildNextOutfit(normalizedItems, {}, {}, false, {}, defaultGenerationLists, emptyOutfitFilters, defaultOutfitFilterRules));
    setIgnoredImportImages(nextAppState?.ignoredImportImages ?? []);
    setSavedOutfits((nextAppState?.savedOutfits ?? []).map(normalizeSavedOutfit));
    setGenerationLists(normalizeGenerationLists(nextAppState?.generationLists));
    setOutfitFilters(normalizeOutfitFilters(nextAppState?.outfitFilters));
    setOutfitFilterRules(normalizeOutfitFilterRules(nextAppState?.outfitFilterRules));
    setFitpics(nextAppState?.fitpics ?? []);
    setWardrobeFilters(emptyWardrobeFilters);
    setWardrobeSort("");
    setEditingId(null);
    setEditorReturnTarget(null);
    setDraft(emptyForm);
    setActivePanel(null);
    setControlsOpen(true);
    setOutfitFiltersOpen(false);
    setActiveAccessorySlot(null);
    setActiveOutfitSlot(null);
    setPickerAnchorSlot(null);
    setFitpicPreview(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
  }

  async function handleExportBackup() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });
    const date = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `outfit-app-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportBackup(event) {
    const [file] = event.target.files;
    event.target.value = "";

    if (!file) {
      return;
    }

    let backup;

    try {
      backup = JSON.parse(await readFileAsText(file));
    } catch {
      window.alert("This backup file could not be read.");
      return;
    }

    if (!validateBackup(backup)) {
      window.alert("This is not a valid outfit app backup.");
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Import backup?",
      message: "This will replace all wardrobe data in this browser.",
      confirmLabel: "Import"
    });

    if (!confirmed) {
      return;
    }

    await replaceWithBackup(backup);
    applyLoadedData(backup.items, backup.appState);
    window.alert("Backup imported.");
  }

  async function handleExportOutfitImage() {
    const stage = outfitStageRef.current;

    if (!stage) {
      return;
    }

    const images = [...stage.querySelectorAll(".outfit-slot img, .accessory-slot.has-item img")];

    if (!images.length) {
      window.alert("There is no outfit image to export.");
      return;
    }

    await Promise.all(
      images.map((image) => (image.complete ? Promise.resolve() : image.decode?.() ?? Promise.resolve()))
    );

    const stageRect = stage.getBoundingClientRect();
    const imageRects = images.map((image) => image.getBoundingClientRect());
    const margin = 24;
    const cropLeft = Math.max(Math.min(...imageRects.map((rect) => rect.left)) - margin, stageRect.left);
    const cropTop = Math.max(Math.min(...imageRects.map((rect) => rect.top)) - margin, stageRect.top);
    const cropRight = Math.min(Math.max(...imageRects.map((rect) => rect.right)) + margin, stageRect.right);
    const cropBottom = Math.min(Math.max(...imageRects.map((rect) => rect.bottom)) + margin, stageRect.bottom);
    const cropWidth = Math.max(cropRight - cropLeft, 1);
    const cropHeight = Math.max(cropBottom - cropTop, 1);
    const scale = 2;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.round(cropWidth * scale);
    canvas.height = Math.round(cropHeight * scale);
    context.scale(scale, scale);
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f7f7f7";
    context.fillRect(0, 0, cropWidth, cropHeight);

    try {
      images.forEach((image) => {
        const imageRect = image.getBoundingClientRect();
        context.drawImage(
          image,
          imageRect.left - cropLeft,
          imageRect.top - cropTop,
          imageRect.width,
          imageRect.height
        );
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `outfit-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.alert("The outfit image could not be exported.");
    }
  }

  async function handleExportWardrobeImage() {
    const exportItems = visibleWardrobeItems.filter((item) => !excluded[item.id]);

    if (!exportItems.length) {
      window.alert("There are no filtered wardrobe pieces to export.");
      return;
    }

    const shuffledItems = [...exportItems].sort(() => Math.random() - 0.5);
    const cellSize = 190;
    const columns = Math.max(1, Math.ceil(Math.sqrt(shuffledItems.length * 1.18)));
    const rows = Math.ceil(shuffledItems.length / columns);
    const padding = 44;
    const canvasWidth = columns * cellSize + padding * 2;
    const canvasHeight = rows * cellSize + padding * 2;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      window.alert("The wardrobe image could not be exported.");
      return;
    }

    canvas.width = canvasWidth * 2;
    canvas.height = canvasHeight * 2;
    context.scale(2, 2);
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f7f7f7";
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    try {
      const loadedItems = await Promise.all(
        shuffledItems.map(async (item) => ({
          item,
          image: await loadImage(resolveImageUrl(item.imageUrl))
        }))
      );

      loadedItems.forEach(({ item, image }, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const cellLeft = padding + column * cellSize;
        const cellTop = padding + row * cellSize;
        const maxImageSize = cellSize * 0.78;
        const baseScale = Math.min(
          maxImageSize / image.naturalWidth,
          maxImageSize / image.naturalHeight,
          1
        );
        const itemScale = normalizeImageScale(item.imageScale) / 100;
        const drawWidth = image.naturalWidth * baseScale * itemScale;
        const drawHeight = image.naturalHeight * baseScale * itemScale;
        const jitterX = (Math.random() - 0.5) * cellSize * 0.22;
        const jitterY = (Math.random() - 0.5) * cellSize * 0.22;
        const offsetX = (normalizeImageOffset(item.imageOffsetX) / 100) * drawWidth;
        const offsetY = (normalizeImageOffset(item.imageOffsetY) / 100) * drawHeight;
        const drawX = cellLeft + (cellSize - drawWidth) / 2 + jitterX + offsetX;
        const drawY = cellTop + (cellSize - drawHeight) / 2 + jitterY + offsetY;

        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `wardrobe-wishlist-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.alert("The wardrobe image could not be exported.");
    }
  }

  async function handleResetToDefault() {
    const confirmed = await requestConfirmation({
      title: "Reset to default?",
      message:
        "This will replace all local wardrobe data, saved outfits, fitpics, settings, and imported backup data for this site.",
      confirmLabel: "Reset"
    });

    if (!confirmed) {
      return;
    }

    const defaultData = await resetToDefaults();
    applyLoadedData(defaultData.items, defaultData.appState);
    window.alert("Default data restored.");
  }

  function getSlotOptionsForOutfit(slot, nextOutfit) {
    let pool = getPool(items, slot, excluded, generationLists, true);

    if (slot === "TopInner" || slot === "TopOuter") {
      const otherTopSlot = getOtherTopSlot(slot);
      const otherItem = otherTopSlot ? itemsById[nextOutfit[otherTopSlot]] : null;

      if (otherItem?.layerType === "Both") {
        pool = pool.filter((item) => item.layerType !== "Both");
      }

      pool = filterPoolForLayeringRules(pool, slot, nextOutfit, itemsById);
    }

    return applyOutfitFiltersToPool(
      pool.filter((item) => item.id !== nextOutfit[getOtherTopSlot(slot)]),
      outfitFilters,
      outfitFilterRules
    );
  }

  function toggleAccessories() {
    setAccessoriesEnabled((current) => {
      const nextValue = !current;

      if (!nextValue) {
        setOutfit((previous) => {
          const nextOutfit = { ...previous };
          accessorySlots.forEach((slot) => {
            nextOutfit[slot] = null;
          });
          return nextOutfit;
        });
        setLocked((previous) => {
          const nextLocked = { ...previous };
          accessorySlots.forEach((slot) => {
            delete nextLocked[slot];
          });
          return nextLocked;
        });
        setActiveAccessorySlot(null);
      }

      return nextValue;
    });
  }

  function toggleLock(slot) {
    setLocked((current) => ({
      ...current,
      [slot]: !current[slot]
    }));
  }

  function equipItem(item) {
    let slot = resolveSlotForItem(item);
    if (!slot) {
      return;
    }

    if (!layering && item.garmentType === "Top") {
      slot = "TopInner";
    }

    if (outfit[slot] === item.id) {
      setOutfit((current) => ({
        ...current,
        [slot]: null
      }));
      return;
    }

    setOutfit((current) => {
      const nextOutfit = {
        ...current,
        [slot]: item.id
      };

      if (slot === "TopInner" || slot === "TopOuter") {
        const otherTopSlot = getOtherTopSlot(slot);
        const otherItem = otherTopSlot ? itemsById[current[otherTopSlot]] : null;

        if (otherItem && isNonStackableTopType(item) && normalizeType(otherItem.type) === normalizeType(item.type)) {
          nextOutfit[otherTopSlot] = null;
        }
      }

      return nextOutfit;
    });
  }

  function resolveSlotForItem(item) {
    if (item.garmentType === "Headwear") {
      return "Headwear";
    }

    if (item.garmentType === "Bottom") {
      return "Bottom";
    }

    if (item.garmentType === "Footwear") {
      return "Footwear";
    }

    if (item.garmentType === "Accessory") {
      return item.accessorySlot || null;
    }

    if (item.garmentType !== "Top") {
      return null;
    }

    if (item.layerType === "Outer") {
      return "TopOuter";
    }

    return "TopInner";
  }

  function startCreate() {
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setImageUploadError("");
    setImageProcessing(false);
    setEditorFloatingOpen(false);
    setEditorReturnTarget("wardrobe");
    setEditingId("new");
    setDraft(emptyForm);
  }

  function startEdit(item, options = {}) {
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setImageUploadError("");
    setImageProcessing(false);
    setEditorFloatingOpen(Boolean(options.floating));
    setEditorReturnTarget(options.returnTarget ?? "wardrobe");
    setEditingId(item.id);
    setDraft(normalizeItem(item));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditorFloatingOpen(false);
    setEditorReturnTarget(null);
    setDraft(emptyForm);
    setImageUploadError("");
    setImageProcessing(false);
  }

  function startFloatingEdit(item) {
    startEdit(item, { floating: true, returnTarget: "outfit" });
    closePickerOverlay();
    setActivePanel(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
  }

  function toggleExcluded(itemId) {
    setExcluded((current) => {
      const nextValue = !current[itemId];
      const nextExcluded = {
        ...current,
        [itemId]: nextValue
      };

      if (!nextValue) {
        return nextExcluded;
      }

      setOutfit((previous) => {
        const sanitized = Object.fromEntries(
          Object.entries(previous).map(([slot, equippedId]) => [
            slot,
            equippedId === itemId ? null : equippedId
          ])
        );

        return buildNextOutfit(items, sanitized, locked, layering, nextExcluded, generationLists, outfitFilters, outfitFilterRules);
      });

      return nextExcluded;
    });
  }

  function clearExcluded() {
    setExcluded({});
  }

  function clearWardrobeFilters() {
    setWardrobeFilters(emptyWardrobeFilters);
  }

  function toggleOutfitFilter(group, value) {
    setOutfitFilters((current) => {
      const selectedValues = current[group] ?? [];
      const isSelected = selectedValues.includes(value);

      return {
        ...current,
        [group]: isSelected
          ? selectedValues.filter((selectedValue) => selectedValue !== value)
          : [...selectedValues, value]
      };
    });
  }

  function clearOutfitFilters() {
    setOutfitFilters(emptyOutfitFilters);
  }

  function toggleDraftTag(field, value, options) {
    setDraft((current) => {
      const selectedValues = normalizeTagList(current[field], options);
      const isSelected = selectedValues.includes(value);

      return {
        ...current,
        [field]: isSelected
          ? selectedValues.filter((selectedValue) => selectedValue !== value)
          : [...selectedValues, value]
      };
    });
  }

  function toggleOutfitFilterRule(section, group, type) {
    setOutfitFilterRules((current) => {
      const normalizedCurrent = normalizeOutfitFilterRules(current);
      const selectedTypes = normalizedCurrent[section][group] ?? [];
      const isSelected = selectedTypes.includes(type);

      return {
        ...normalizedCurrent,
        [section]: {
          ...normalizedCurrent[section],
          [group]: isSelected
            ? selectedTypes.filter((selectedType) => selectedType !== type)
            : [...selectedTypes, type]
        }
      };
    });
  }

  function resetOutfitFilterRules() {
    setOutfitFilterRules(cloneOutfitFilterRules());
  }

  function toggleGenerationList(list) {
    setGenerationLists((current) => ({
      ...current,
      [list]: !current[list]
    }));
  }

  function updateType(nextType) {
    const normalizedNextType = normalizeItemType(nextType);
    const inferredGarmentType = garmentTypeByItemType[normalizedNextType];
    const resolvedGarmentType = inferredGarmentType ?? draft.garmentType;
    const inferredLayerType = layerTypeByItemType[normalizedNextType];
    const inferredAccessorySlot = accessorySlotByItemType[normalizedNextType];

    setDraft((current) => ({
      ...current,
      type: normalizedNextType,
      garmentType: inferredGarmentType ?? current.garmentType,
      layerType:
        resolvedGarmentType === "Top"
          ? inferredLayerType ?? "Inner"
          : "Both",
      accessorySlot:
        resolvedGarmentType === "Accessory"
          ? inferredAccessorySlot ?? current.accessorySlot
          : "",
      size:
        resolvedGarmentType === "Accessory" && !current.size.trim()
          ? "OS"
          : current.size
    }));
  }

  async function submitItem(event) {
    event.preventDefault();

    const trimmedName = draft.name.trim();
    const trimmedImageUrl = draft.imageUrl.trim();
    const trimmedBrand = draft.brand.trim();
    const trimmedType = draft.type.trim();
    const trimmedColor = draft.color.trim();
    const trimmedSize = draft.size.trim();
    const normalizedValue = String(draft.value ?? "").replace(/[^\d]/g, "");
    const normalizedRetailValue = String(draft.retailValue ?? "").replace(/[^\d]/g, "");
    const normalizedImageScale = normalizeImageScale(draft.imageScale);
    const normalizedImageOffsetX = normalizeImageOffset(draft.imageOffsetX);
    const normalizedImageOffsetY = normalizeImageOffset(draft.imageOffsetY);
    const normalizedQuantity = normalizeQuantity(draft.quantity);

    if (!trimmedImageUrl) {
      setImageUploadError("Choose an image or enter an image URL before saving.");
      return;
    }

    setImageUploadError("");

    if (
      editingId === "new" &&
      !trimmedName &&
      !trimmedBrand &&
      !trimmedType &&
      !trimmedColor &&
      !normalizedValue &&
      !normalizedRetailValue &&
      !trimmedSize
    ) {
      return;
    }

    const normalizedDraft = {
      ...draft,
      name: trimmedName,
      imageUrl: trimmedImageUrl,
      imageScale: normalizedImageScale,
      imageOffsetX: normalizedImageOffsetX,
      imageOffsetY: normalizedImageOffsetY,
      brand: trimmedBrand,
      type: normalizeItemType(trimmedType),
      color: trimmedColor,
      favorite: Boolean(draft.favorite),
      value: normalizedValue,
      retailValue: normalizedRetailValue,
      size: trimmedSize,
      list: normalizeList(draft.list),
      quantity: normalizedQuantity,
      styleTags: normalizeTagList(draft.styleTags, styleTagOptions),
      climateTags: normalizeTagList(draft.climateTags, climateTagOptions)
    };

    const nextItem = {
      ...normalizedDraft,
      id:
        editingId === "new"
          ? createUniqueItemId(
              {
                ...normalizedDraft
              },
              items
            )
          : createUniqueItemId(
              {
                ...normalizedDraft
              },
              items,
              draft.id
            ),
      name: trimmedName
    };

    await saveItem(nextItem);

    if (editingId !== "new" && draft.id !== nextItem.id) {
      await deleteItem(draft.id);
    }

    setItems((current) => {
      const existingIndex = current.findIndex((item) =>
        item.id === (editingId === "new" ? nextItem.id : draft.id)
      );

      if (existingIndex === -1) {
        return [...current, nextItem];
      }

      const clone = [...current];
      clone[existingIndex] = nextItem;
      return clone;
    });

    if (editingId !== "new" && draft.id !== nextItem.id) {
      setOutfit((current) =>
        replaceItemIdInOutfit(current, draft.id, nextItem.id)
      );
      setSavedOutfits((current) =>
        current.map((savedOutfit) => ({
          ...savedOutfit,
          outfit: replaceItemIdInOutfit(savedOutfit.outfit, draft.id, nextItem.id)
        }))
      );
    }

    const shouldReturnToWardrobe = editorReturnTarget === "wardrobe" && activePanel !== "wardrobe";
    cancelEdit();

    if (shouldReturnToWardrobe) {
      setActivePanel("wardrobe");
      setControlsOpen(false);
    }
  }

  async function handleItemImageUpload(event) {
    const [file] = event.target.files;

    if (!file) {
      return;
    }

    try {
      setImageUploadError("");
      const imageUrl = await compressImageSource(file);
      setDraft((current) => ({ ...current, imageUrl }));
    } catch (error) {
      setImageUploadError(error?.message || "This image could not be processed.");
    } finally {
      event.target.value = "";
    }
  }

  function removeDraftImage() {
    setDraft((current) => ({ ...current, imageUrl: "" }));
    setImageUploadError("");
  }

  async function removeDraftBackground() {
    const originalImageUrl = draft.imageUrl.trim();

    if (!isLocalDataImage(originalImageUrl) || imageProcessing) {
      return;
    }

    try {
      setImageProcessing(true);
      setImageUploadError("");
      const inputBlob = await dataUrlToBlob(originalImageUrl);
      const backgroundRemovalModule = await import("@imgly/background-removal");
      const removeBackground = getRemoveBackgroundExport(backgroundRemovalModule);
      const transparentBlob = await removeBackground(inputBlob, {
        model: "small",
        output: {
          format: "image/png",
          quality: 0.9
        }
      });
      const compressedImageUrl = await compressImageSource(transparentBlob);
      setDraft((current) => ({ ...current, imageUrl: compressedImageUrl }));
    } catch (error) {
      setImageUploadError(error?.message || "Background could not be removed.");
    } finally {
      setImageProcessing(false);
    }
  }

  async function handleDelete(itemId) {
    const confirmed = await requestConfirmation({
      title: "Delete item?",
      message: "This wardrobe item will be removed from outfits and saved outfits in this browser.",
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return false;
    }

    await deleteItem(itemId);
    setItems((current) => current.filter((item) => item.id !== itemId));
    setOutfit((current) => clearItemIdFromOutfit(current, itemId));
    setSavedOutfits((current) =>
      current.map((savedOutfit) => ({
        ...savedOutfit,
        outfit: clearItemIdFromOutfit(savedOutfit.outfit, itemId)
      }))
    );
    return true;
  }

  async function handleEditorDelete() {
    if (!draft.id || editingId === "new") {
      return;
    }

    const deleted = await handleDelete(draft.id);

    if (deleted) {
      cancelEdit();
    }
  }

  function saveCurrentOutfit() {
    setSavedOutfits((current) => [
      normalizeSavedOutfit({
        id: `saved_outfit_${Date.now()}`,
        name: createSavedOutfitName(current),
        description: "",
        outfit: { ...outfit },
        layering
      }),
      ...current
    ]);
  }

  function loadSavedOutfit(savedOutfit) {
    const sanitizedOutfit = sanitizeOutfitForExistingItems(savedOutfit.outfit, itemsById);

    setLayering(Boolean(savedOutfit.layering));
    setAccessoriesEnabled(hasAccessoryItems(sanitizedOutfit));
    setOutfit(sanitizedOutfit);
    setActiveAccessorySlot(null);
    setActiveOutfitSlot(null);
  }

  function renderSavedOutfitPreview(savedOutfit) {
    const previewSlots = getSavedOutfitPreviewSlots(savedOutfit);

    return (
      <div className={`saved-preview ${savedOutfit.layering ? "is-layered" : ""}`} aria-hidden="true">
        {previewSlots.map((slot) => {
          const itemId = savedOutfit.outfit?.[slot];
          const item = itemId ? itemsById[itemId] : null;

          const slotClass = `saved-preview-piece saved-preview-${slot.toLowerCase()}`;

          if (!item) {
            return (
              <div
                key={`${savedOutfit.id}-${slot}`}
                className={`${slotClass} ${itemId ? "saved-preview-missing" : "saved-preview-empty"}`}
              />
            );
          }

          return (
            <div key={`${savedOutfit.id}-${slot}`} className={slotClass}>
              <img src={item.imageUrl} alt="" style={getItemImageStyle(item)} />
            </div>
          );
        })}
      </div>
    );
  }

  function renderAccessorySlot(slot) {
    const item = itemsById[outfit[slot]];
    const isActive = activeAccessorySlot === slot;

    return (
      <button
        key={slot}
        type="button"
        className={`accessory-slot accessory-slot-${slot.toLowerCase()} ${item ? "has-item" : ""} ${isActive ? "is-active" : ""}`}
        onClick={() => openAccessoryPicker(slot)}
        aria-label={`${getAccessoryLabel(slot)} options`}
      >
        {item ? <img src={item.imageUrl} alt={item.name} style={getItemImageStyle(item)} /> : null}
      </button>
    );
  }

  function openAccessoryPicker(slot) {
    setActiveAccessorySlot((current) => {
      const nextSlot = current === slot ? null : slot;
      setPickerAnchorSlot(nextSlot);

      if (nextSlot) {
        setActiveOutfitSlot(null);
        setActivePanel(null);
      }

      return nextSlot;
    });
  }

  function openOutfitSlotPicker(slot) {
    setActiveOutfitSlot((current) => {
      const nextSlot = current === slot ? null : slot;
      setPickerAnchorSlot(nextSlot);

      if (nextSlot) {
        setActiveAccessorySlot(null);
        setActivePanel(null);
      }

      return nextSlot;
    });
  }

  function getPickerPositionClass() {
    if (!pickerAnchorSlot) {
      return "picker-overlay-right";
    }

    if (layering && pickerAnchorSlot === "TopOuter") {
      return "picker-overlay-left";
    }

    if (pickerAnchorSlot === "RightHand" || pickerAnchorSlot === "Bag") {
      return "picker-overlay-left";
    }

    return "picker-overlay-right";
  }

  function closePickerOverlay() {
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
  }

  function toggleWorkspacePanel(panel) {
    setActivePanel((current) => {
      const nextPanel = current === panel ? null : panel;
      if (nextPanel) {
        setControlsOpen(false);
        setOutfitFiltersOpen(false);
      }
      setActiveOutfitSlot(null);
      setActiveAccessorySlot(null);
      setPickerAnchorSlot(null);
      setWardrobeFiltersOpen(false);
      setWardrobeWorthOpen(false);
      setWardrobeSavedOpen(false);
      setWardrobeManageOpen(false);
      setFitpicPreview(null);
      setEditorFloatingOpen(false);
      setEditingId(null);
      setEditorReturnTarget(null);
      return nextPanel;
    });
  }

  function closeWorkspacePanel() {
    setActivePanel(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setFitpicPreview(null);
  }

  function toggleControlsWindow() {
    if (activePanel) {
      setActivePanel(null);
    }

    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setOutfitFiltersOpen(false);
    setFitpicPreview(null);
    setEditorFloatingOpen(false);
    setEditingId(null);
    setEditorReturnTarget(null);
    setControlsOpen((current) => !current);
  }

  function toggleOutfitFiltersInControls() {
    setOutfitFiltersOpen((current) => !current);
  }

  function openWardrobeFilters() {
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeFiltersOpen(true);
  }

  function toggleWardrobeWorth() {
    setWardrobeFiltersOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeWorthOpen((current) => !current);
  }

  function toggleWardrobeSaved() {
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeManageOpen(false);
    setWardrobeSavedOpen((current) => !current);
  }

  function toggleWardrobeManage() {
    setWardrobeFiltersOpen(false);
    setWardrobeWorthOpen(false);
    setWardrobeSavedOpen(false);
    setWardrobeManageOpen((current) => !current);
  }

  function loadAndCloseSavedOutfit(savedOutfit) {
    loadSavedOutfit(savedOutfit);
    setWardrobeSavedOpen(false);
    setActivePanel(null);
  }

  function renderOutfitSlotPicker() {
    if (!activeOutfitSlot) {
      return null;
    }

    const options = getSlotPickerOptions(activeOutfitSlot);
    const isLocked = Boolean(locked[activeOutfitSlot]);
    const currentItem = itemsById[outfit[activeOutfitSlot]];

    return (
      <div className="slot-picker">
        <div className="slot-picker-header">
          <strong>{getSlotLabel(activeOutfitSlot)}</strong>
          <button type="button" className="ghost-button" onClick={closePickerOverlay}>
            Close
          </button>
        </div>

        <div className="slot-picker-actions">
          <button
            type="button"
            className={`ghost-button ${isLocked ? "is-active" : ""}`}
            onClick={() => toggleLock(activeOutfitSlot)}
          >
            {isLocked ? "Unlock" : "Lock"}
          </button>
          <button type="button" className="ghost-button" onClick={() => handleReroll(activeOutfitSlot)}>
            Reroll
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleOutfitSlot(activeOutfitSlot, -1)}>
            Previous
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleOutfitSlot(activeOutfitSlot, 1)}>
            Next
          </button>
          {currentItem ? (
            <button type="button" className="ghost-button" onClick={() => startFloatingEdit(currentItem)}>
              Edit
            </button>
          ) : null}
          <button type="button" className="ghost-button danger" onClick={() => removeOutfitSlot(activeOutfitSlot)}>
            Remove
          </button>
        </div>

        {options.length ? (
          <div className="slot-picker-list">
            {options.map((item) => {
              const isExcluded = Boolean(excluded[item.id]);

              return (
                <article
                  key={item.id}
                  className={`slot-picker-item ${outfit[activeOutfitSlot] === item.id ? "is-current" : ""} ${isExcluded ? "is-excluded" : ""}`}
                >
                  <button
                    type="button"
                    className="slot-picker-select"
                    onClick={() => setOutfitSlot(activeOutfitSlot, item.id)}
                  >
                    <img src={item.imageUrl} alt={item.name} style={getItemImageStyle(item)} />
                    <span>{buildDisplayName(item)}</span>
                  </button>
                  <button
                    type="button"
                    className={`picker-exclude-toggle ${isExcluded ? "is-active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExcluded(item.id);
                    }}
                    aria-label={isExcluded ? "Include item in generation" : "Exclude item from generation"}
                  >
                    {isExcluded ? "×" : "✓"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="editor-placeholder">
            <p>No compatible items available for this slot.</p>
          </div>
        )}
      </div>
    );
  }

  function renderAccessoryPicker() {
    if (!activeAccessorySlot) {
      return null;
    }

    const currentItem = itemsById[outfit[activeAccessorySlot]];

    return (
      <div className="accessory-picker">
        <div className="accessory-picker-header">
          <strong>{getAccessoryLabel(activeAccessorySlot)}</strong>
          <button
            type="button"
            className="ghost-button"
            onClick={closePickerOverlay}
          >
            Close
          </button>
        </div>

        <div className="accessory-picker-actions">
          <button type="button" className="ghost-button" onClick={() => cycleAccessorySlot(activeAccessorySlot, -1)}>
            Previous
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleAccessorySlot(activeAccessorySlot, 1)}>
            Next
          </button>
          {currentItem ? (
            <button type="button" className="ghost-button" onClick={() => startFloatingEdit(currentItem)}>
              Edit
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button"
            onClick={() => removeAccessoryFromSlot(activeAccessorySlot)}
          >
            Remove
          </button>
        </div>

        {compatibleAccessoryOptions.length ? (
          <div className="accessory-picker-list">
            {compatibleAccessoryOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`accessory-picker-item ${outfit[activeAccessorySlot] === item.id ? "is-current" : ""}`}
                onClick={() => swapAccessory(activeAccessorySlot, item.id)}
              >
                <img src={item.imageUrl} alt={item.name} style={getItemImageStyle(item)} />
                <span>{buildDisplayName(item)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="editor-placeholder">
            <p>No compatible accessories available for this slot.</p>
          </div>
        )}
      </div>
    );
  }

  function renderSavedOutfitsContent() {
    if (!savedOutfits.length) {
      return (
        <div className="editor-placeholder">
          <p>Save an outfit you like and it will appear here.</p>
        </div>
      );
    }

    return (
      <div className="saved-outfits-list">
        {savedOutfits.map((savedOutfit) => (
          <article key={savedOutfit.id} className="saved-outfit-card">
            {editingSavedOutfitId === savedOutfit.id ? (
              <form
                className="saved-outfit-form"
                onSubmit={(event) => submitSavedOutfit(event, savedOutfit.id)}
              >
                <label>
                  Name
                  <input
                    value={savedOutfitDraft.name}
                    onChange={(event) =>
                      setSavedOutfitDraft((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={savedOutfitDraft.description}
                    onChange={(event) =>
                      setSavedOutfitDraft((current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                    rows="3"
                  />
                </label>
                <div className="saved-outfit-actions">
                  <button type="submit" className="primary-button">Save</button>
                  <button type="button" className="ghost-button" onClick={cancelEditSavedOutfit}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className="saved-outfit-load"
                  onClick={() => loadAndCloseSavedOutfit(savedOutfit)}
                >
                  {renderSavedOutfitPreview(savedOutfit)}
                  <strong>{savedOutfit.name}</strong>
                  <span>{savedOutfit.description || "No description"}</span>
                  {savedOutfitHasMissingItems(savedOutfit, itemsById) ? (
                    <span className="saved-outfit-warning">Missing item</span>
                  ) : null}
                </button>
                <div className="saved-outfit-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => startEditSavedOutfit(savedOutfit)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() => deleteSavedOutfit(savedOutfit.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    );
  }

  function startEditSavedOutfit(savedOutfit) {
    setEditingSavedOutfitId(savedOutfit.id);
    setSavedOutfitDraft({
      name: savedOutfit.name ?? "",
      description: savedOutfit.description ?? ""
    });
  }

  function cancelEditSavedOutfit() {
    setEditingSavedOutfitId(null);
    setSavedOutfitDraft({ name: "", description: "" });
  }

  function submitSavedOutfit(event, savedOutfitId) {
    event.preventDefault();

    const trimmedName = savedOutfitDraft.name.trim();
    const trimmedDescription = savedOutfitDraft.description.trim();

    setSavedOutfits((current) =>
      current.map((savedOutfit) =>
        savedOutfit.id === savedOutfitId
          ? {
              ...savedOutfit,
              name: trimmedName || savedOutfit.name,
              description: trimmedDescription
            }
          : savedOutfit
      )
    );

    cancelEditSavedOutfit();
  }

  async function deleteSavedOutfit(savedOutfitId) {
    const confirmed = await requestConfirmation({
      title: "Delete outfit?",
      message: "This saved outfit will be removed from this browser.",
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    setSavedOutfits((current) => current.filter((savedOutfit) => savedOutfit.id !== savedOutfitId));

    if (editingSavedOutfitId === savedOutfitId) {
      cancelEditSavedOutfit();
    }
  }

  async function handleFitpicUpload(event) {
    const files = [...event.target.files];

    if (!files.length) {
      return;
    }

    const nextFitpics = await Promise.all(
      files.map(async (file) => ({
        id: createFitpicId(),
        name: file.name.replace(/\.[^.]+$/, ""),
        imageData: await readFileAsDataUrl(file),
        createdAt: new Date().toISOString()
      }))
    );

    setFitpics((current) => [...nextFitpics, ...current]);
    event.target.value = "";
  }

  async function deleteFitpic(fitpicId) {
    const confirmed = await requestConfirmation({
      title: "Delete fitpic?",
      message: "This fitpic will be removed from this browser.",
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    setFitpics((current) => current.filter((fitpic) => fitpic.id !== fitpicId));
  }

  function removeAccessoryFromSlot(slot) {
    setOutfit((current) => ({
      ...current,
      [slot]: null
    }));
    setLocked((current) => ({
      ...current,
      [slot]: false
    }));
  }

  function swapAccessory(slot, itemId) {
    setOutfit((current) => ({
      ...current,
      [slot]: itemId
    }));
    setActiveAccessorySlot(null);
  }

  if (loading) {
    return <main className="app-shell loading-state">Loading wardrobe…</main>;
  }

  const editorTitle = editingId
    ? editingId === "new"
      ? "Add wardrobe item"
      : "Edit wardrobe item"
    : "Item editor";
  const visibleOutfitFilterRules = normalizeOutfitFilterRules(outfitFilterRules);

  const editorBody = editingId ? (
    <form className="editor-form" onSubmit={submitItem}>
      <div className="item-image-upload">
        <div className="item-image-preview">
          {draft.imageUrl.trim() ? (
            <img src={resolveImageUrl(draft.imageUrl.trim())} alt="" style={getItemImageStyle(draft)} />
          ) : (
            <span>No image selected</span>
          )}
        </div>
        <div className="item-image-actions">
          <label className="upload-button">
            {draft.imageUrl.trim() ? "Change image" : "Choose image"}
            <input type="file" accept="image/*" onChange={handleItemImageUpload} disabled={imageProcessing} />
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={removeDraftBackground}
            disabled={!canRemoveDraftBackground || imageProcessing}
          >
            {imageProcessing ? "Removing..." : "Remove background"}
          </button>
          {draft.imageUrl.trim() ? (
            <button type="button" className="ghost-button" onClick={removeDraftImage} disabled={imageProcessing}>
              Remove image
            </button>
          ) : null}
          <label className="image-size-field">
            Image size
            <div className="image-scale-control">
              <input
                type="range"
                min="50"
                max="180"
                step="5"
                value={normalizeImageScale(draft.imageScale)}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, imageScale: Number(event.target.value) }))
                }
              />
              <input
                inputMode="numeric"
                value={normalizeImageScale(draft.imageScale)}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, imageScale: normalizeImageScale(event.target.value) }))
                }
                aria-label="Image size percentage"
              />
              <span>%</span>
            </div>
          </label>
        </div>
        <p className="item-image-note">
          Images are saved in this browser and included in backup JSON. Background removal runs locally and may take a moment.
        </p>
        {imageUploadError ? <p className="form-error">{imageUploadError}</p> : null}
      </div>

      <label>
        Type
        <select
          value={draft.type}
          onChange={(event) => updateType(event.target.value)}
        >
          <option value="">Select type</option>
          {itemTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label>
        Garment type
        <select
          value={draft.garmentType}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              garmentType: event.target.value,
              layerType: event.target.value === "Top" ? current.layerType : "Both",
              accessorySlot: event.target.value === "Accessory" ? current.accessorySlot : "",
              size:
                event.target.value === "Accessory" && !current.size.trim()
                  ? "OS"
                  : current.size
            }))
          }
        >
          {garmentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {draft.garmentType === "Top" ? (
        <label>
          Layer type
          <select
            value={draft.layerType}
            onChange={(event) =>
              setDraft((current) => ({ ...current, layerType: event.target.value }))
            }
          >
            {layerTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {draft.garmentType === "Accessory" ? (
        <label>
          Accessory slot
          <select
            value={draft.accessorySlot}
            onChange={(event) =>
              setDraft((current) => ({ ...current, accessorySlot: event.target.value }))
            }
          >
            <option value="">Select slot</option>
            {accessorySlots.map((slot) => (
              <option key={slot} value={slot}>
                {getAccessoryLabel(slot)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label>
        Brand
        <input
          value={draft.brand}
          onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))}
          placeholder="Brand"
        />
      </label>

      <label>
        Name
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="Grey wool beanie"
        />
      </label>

      <label>
        Color
        <input
          value={draft.color}
          onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
          placeholder="Black"
        />
      </label>

      <label>
        Size
        <input
          value={draft.size}
          onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))}
          placeholder="M"
        />
      </label>

      <label>
        List
        <select
          value={draft.list}
          onChange={(event) => setDraft((current) => ({ ...current, list: event.target.value }))}
        >
          {itemLists.map((list) => (
            <option key={list} value={list}>
              {list}
            </option>
          ))}
        </select>
      </label>

      <label>
        Quantity
        <input
          inputMode="numeric"
          min="1"
          value={draft.quantity}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              quantity: event.target.value.replace(/[^\d]/g, "")
            }))
          }
          placeholder="1"
        />
      </label>

      <label>
        Value
        <input
          inputMode="numeric"
          value={draft.value}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              value: event.target.value.replace(/[^\d]/g, "")
            }))
          }
          placeholder="120"
        />
      </label>

      <label>
        Retail value
        <input
          inputMode="numeric"
          value={draft.retailValue}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              retailValue: event.target.value.replace(/[^\d]/g, "")
            }))
          }
          placeholder="280"
        />
      </label>

      <section className="metadata-tag-group" aria-label="Style metadata">
        <p className="eyebrow">Style tags</p>
        <div className="metadata-tag-options">
          {styleTagOptions.map((tag) => {
            const isSelected = normalizeTagList(draft.styleTags, styleTagOptions).includes(tag);

            return (
              <button
                key={tag}
                type="button"
                className={`list-toggle ${isSelected ? "is-active" : ""}`}
                onClick={() => toggleDraftTag("styleTags", tag, styleTagOptions)}
                aria-pressed={isSelected}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </section>

      <section className="metadata-tag-group" aria-label="Climate metadata">
        <p className="eyebrow">Climate tags</p>
        <div className="metadata-tag-options">
          {climateTagOptions.map((tag) => {
            const isSelected = normalizeTagList(draft.climateTags, climateTagOptions).includes(tag);

            return (
              <button
                key={tag}
                type="button"
                className={`list-toggle ${isSelected ? "is-active" : ""}`}
                onClick={() => toggleDraftTag("climateTags", tag, climateTagOptions)}
                aria-pressed={isSelected}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </section>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={Boolean(draft.favorite)}
          onChange={(event) => setDraft((current) => ({ ...current, favorite: event.target.checked }))}
        />
        Favorite
      </label>

      <div className="id-preview">
        <span>Generated item ID</span>
        <strong>{generatedIdPreview || "Starts generating once metadata is filled in"}</strong>
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-button">Save item</button>
        {editingId !== "new" ? (
          <button type="button" className="ghost-button danger" onClick={handleEditorDelete}>
            Delete
          </button>
        ) : null}
        <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel</button>
      </div>
    </form>
  ) : (
    <div className="editor-placeholder">
      <p>Select an item to edit it, or use Add item to create a wardrobe entry.</p>
      <p>Uploaded item images are saved in this browser and included in backup JSON.</p>
    </div>
  );

  function renderOutfitSlot(slot) {
    const item = itemsById[outfit[slot]];
    const isActive = activeOutfitSlot === slot;
    return (
      <div key={slot} className="outfit-slot-wrap">
        <article
          className={`outfit-slot outfit-slot-${slot.toLowerCase()} ${locked[slot] ? "is-locked" : ""} ${isActive ? "is-active" : ""}`}
        >
          <button
            type="button"
            className={`item-figure ${item ? "has-item" : "is-empty"}`}
            onClick={() => openOutfitSlotPicker(slot)}
            aria-label={`${getSlotLabel(slot)} options`}
          >
            {item ? <img src={item.imageUrl} alt={item.name} style={getItemImageStyle(item)} /> : <span aria-hidden="true" />}
          </button>
        </article>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <section className="content-grid">
        <div className="current-outfit-panel">
          <div ref={outfitStageRef} className="outfit-stage">
            {accessoriesEnabled ? (
              <div className="accessory-ring">
                {accessorySlots.map((slot) => renderAccessorySlot(slot))}
              </div>
            ) : null}

            <div className="outfit-grid">
              {outfitLayout.map((entry) => {
                if (entry === "TopGroup") {
                  if (layering) {
                    return (
                      <div key={entry} className="top-layer-row">
                        {renderOutfitSlot("TopInner")}
                        {renderOutfitSlot("TopOuter")}
                      </div>
                    );
                  }

                  return renderOutfitSlot("TopInner");
                }

                return renderOutfitSlot(entry);
              })}
            </div>
          </div>

        </div>

        {activeOutfitSlot || activeAccessorySlot ? (
          <div ref={pickerOverlayRef} className={`picker-overlay ${getPickerPositionClass()}`}>
            {activeOutfitSlot ? renderOutfitSlotPicker() : renderAccessoryPicker()}
          </div>
        ) : null}

        <div className="workspace-tabs" aria-label="Workspace sections">
          <button type="button" className="workspace-tab is-active" onClick={handleGenerate}>
            Generate
          </button>
          <button
            type="button"
            className={`workspace-tab ${controlsOpen && !activePanel ? "is-active" : ""}`}
            onClick={toggleControlsWindow}
            aria-pressed={controlsOpen && !activePanel}
          >
            CONTROLS
          </button>
          {[
            ["wardrobe", "Wardrobe"],
            ["fitpics", "Fitpics"]
          ].map(([panel, label]) => (
            <button
              key={panel}
              type="button"
              className={`workspace-tab ${activePanel === panel ? "is-active" : ""}`}
              onClick={() => toggleWorkspacePanel(panel)}
              aria-pressed={activePanel === panel}
            >
              {label}
            </button>
          ))}
          {outfitPalette.length ? (
            <button
              type="button"
              className={`palette-tab ${paletteOpen ? "is-active" : ""}`}
              onClick={() => setPaletteOpen((current) => !current)}
              aria-label="Toggle outfit color palette"
              aria-expanded={paletteOpen}
              title="Color palette"
            >
              <span style={{ backgroundColor: outfitPalette[0].color }} />
            </button>
          ) : null}
        </div>

        {paletteOpen && outfitPalette.length ? (
          <div className="outfit-palette" aria-label="Current outfit color palette">
            {outfitPalette.map((entry) => (
              <span
                key={`${entry.color}-${entry.label}`}
                className="outfit-palette-swatch"
                style={{ backgroundColor: entry.color }}
                title={`${entry.label}: ${entry.color}`}
              />
            ))}
          </div>
        ) : null}

        {controlsOpen && !activePanel ? (
          <div className="controls-window" aria-label="Outfit controls">
            <div className="controls-window-header">
              <p className="eyebrow">Current outfit</p>
              <button
                type="button"
                className="controls-hide-button"
                onClick={() => setControlsOpen(false)}
                aria-label="Hide controls"
              >
                ×
              </button>
            </div>

            {!outfitFiltersOpen ? (
              <>
                <button type="button" className={`secondary-button ${layering ? "is-active" : ""}`} onClick={toggleLayering}>
                  Layering: {layering ? "On" : "Off"}
                </button>
                <button type="button" className={`secondary-button ${accessoriesEnabled ? "is-active" : ""}`} onClick={toggleAccessories}>
                  Accessories: {accessoriesEnabled ? "On" : "Off"}
                </button>
                <button type="button" className="ghost-button" onClick={saveCurrentOutfit}>
                  Save outfit
                </button>
                <button type="button" className="ghost-button" onClick={handleExportOutfitImage}>
                  Export outfit image
                </button>

                <div className="generation-list-controls" aria-label="Generation lists">
                  {itemLists.map((list) => (
                    <button
                      key={list}
                      type="button"
                      className={`list-toggle ${generationLists[list] ? "is-active" : ""}`}
                      onClick={() => toggleGenerationList(list)}
                    >
                      {list}: {generationLists[list] ? "Included" : "Off"}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <button
              type="button"
              className={`ghost-button ${outfitFiltersOpen ? "is-active" : ""}`}
              onClick={toggleOutfitFiltersInControls}
              aria-expanded={outfitFiltersOpen}
            >
              Outfit filter
            </button>

            {outfitFiltersOpen ? (
              <div className="outfit-filters-panel" aria-label="Outfit filters">
                <button type="button" className="ghost-button" onClick={clearOutfitFilters}>
                  Clear outfit filters
                </button>

                <div className="outfit-filter-groups">
                  {Object.entries(outfitFilterOptions).map(([group, options]) => (
                    <section key={group} className="outfit-filter-group">
                      <p className="eyebrow">{group}</p>
                      <div className="outfit-filter-options">
                        {options.map((option) => {
                          const isSelected = outfitFilters[group]?.includes(option);

                          return (
                            <button
                              key={option}
                              type="button"
                              className={`list-toggle ${isSelected ? "is-active" : ""}`}
                              onClick={() => toggleOutfitFilter(group, option)}
                              aria-pressed={isSelected}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activePanel ? (
          <div className="floating-backdrop active-panel-backdrop" onClick={closeWorkspacePanel}>
        <div
          className={`active-panel-overlay ${activePanel === "wardrobe" ? "is-wardrobe-panel" : ""}`}
          onClick={(event) => event.stopPropagation()}
        >
        {activePanel === "wardrobe" ? (
        <div className="wardrobe-workspace">
          <div className="panel wardrobe-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Wardrobe</p>
            </div>
            <div className="wardrobe-header-actions">
              <button
                type="button"
                className={`secondary-button filter-button ${hasActiveWardrobeFilters ? "is-active" : ""}`}
                onClick={openWardrobeFilters}
                aria-pressed={hasActiveWardrobeFilters}
                title={
                  hasActiveWardrobeFilters
                    ? `${activeWardrobeFilterCount} active filter${activeWardrobeFilterCount === 1 ? "" : "s"}`
                    : "No active filters"
                }
              >
                {hasActiveWardrobeFilters ? `Filter ${activeWardrobeFilterCount}` : "Filter"}
              </button>
              <button
                type="button"
                className={`secondary-button ${wardrobeWorthOpen ? "is-active" : ""}`}
                onClick={toggleWardrobeWorth}
                aria-expanded={wardrobeWorthOpen}
              >
                Worth
              </button>
              <button
                type="button"
                className={`secondary-button ${wardrobeSavedOpen ? "is-active" : ""}`}
                onClick={toggleWardrobeSaved}
                aria-expanded={wardrobeSavedOpen}
              >
                Saved
              </button>
              <button
                type="button"
                className={`secondary-button ${wardrobeManageOpen ? "is-active" : ""}`}
                onClick={toggleWardrobeManage}
                aria-expanded={wardrobeManageOpen}
              >
                Manage
              </button>
              <button type="button" className="primary-button" onClick={startCreate}>
                Add item
              </button>
            </div>
            </div>

            {wardrobeFiltersOpen ? (
              <div className="floating-backdrop filter-backdrop" onClick={() => setWardrobeFiltersOpen(false)} />
            ) : null}

            {wardrobeWorthOpen ? (
              <div className="floating-backdrop filter-backdrop" onClick={() => setWardrobeWorthOpen(false)} />
            ) : null}

            {wardrobeSavedOpen ? (
              <div className="floating-backdrop filter-backdrop" onClick={() => setWardrobeSavedOpen(false)} />
            ) : null}

            {wardrobeManageOpen ? (
              <div className="floating-backdrop filter-backdrop" onClick={() => setWardrobeManageOpen(false)} />
            ) : null}

            <div className={`wardrobe-controls ${wardrobeFiltersOpen ? "is-open" : ""}`}>
              <label>
                Brand
                <select
                  value={wardrobeFilters.brand}
                  onChange={(event) =>
                    setWardrobeFilters((current) => ({ ...current, brand: event.target.value }))
                  }
                >
                  <option value="">All brands</option>
                  <option value="__none__">No brand</option>
                  {wardrobeFilterOptions.brand.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Garment
                <select
                  value={wardrobeFilters.garmentType}
                  onChange={(event) =>
                    setWardrobeFilters((current) => ({ ...current, garmentType: event.target.value }))
                  }
                >
                  <option value="">All garments</option>
                  <option value="__none__">No garment</option>
                  {wardrobeFilterOptions.garmentType.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select
                  value={wardrobeFilters.type}
                  onChange={(event) =>
                    setWardrobeFilters((current) => ({ ...current, type: event.target.value }))
                  }
                >
                  <option value="">All types</option>
                  <option value="__none__">No type</option>
                  {wardrobeFilterOptions.type.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Color
                <select
                  value={wardrobeFilters.color}
                  onChange={(event) =>
                    setWardrobeFilters((current) => ({ ...current, color: event.target.value }))
                  }
                >
                  <option value="">All colors</option>
                  <option value="__none__">No color</option>
                  {wardrobeFilterOptions.color.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                List
                <select
                  value={wardrobeFilters.list}
                  onChange={(event) =>
                    setWardrobeFilters((current) => ({ ...current, list: event.target.value }))
                  }
                >
                  <option value="">All lists</option>
                  {itemLists.map((list) => (
                    <option key={list} value={list}>{list}</option>
                  ))}
                </select>
              </label>
              <label>
                Favorite
                <select
                  value={wardrobeFilters.favorite}
                  onChange={(event) =>
                    setWardrobeFilters((current) => ({ ...current, favorite: event.target.value }))
                  }
                >
                  <option value="">All</option>
                  <option value="yes">Favorites</option>
                  <option value="no">Not favorites</option>
                </select>
              </label>
              <label>
                Exclude
                <select
                  value={wardrobeFilters.laundry}
                  onChange={(event) =>
                    setWardrobeFilters((current) => ({ ...current, laundry: event.target.value }))
                  }
                >
                  <option value="">All</option>
                  <option value="show">Show excluded</option>
                  <option value="hide">Hide excluded</option>
                </select>
              </label>
              <label>
                Sort
                <select value={wardrobeSort} onChange={(event) => setWardrobeSort(event.target.value)}>
                  <option value="">Default</option>
                  <option value="garmentType">Garment type</option>
                  <option value="brand">Brand A-Z</option>
                  <option value="type">Type A-Z</option>
                  <option value="value">Value</option>
                  <option value="paidHigh">Paid high-low</option>
                  <option value="paidLow">Paid low-high</option>
                  <option value="retailHigh">Retail high-low</option>
                  <option value="retailLow">Retail low-high</option>
                  <option value="color">Color</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </label>
              <button type="button" className="secondary-button clear-excluded-button" onClick={clearExcluded}>
                Clear excluded
              </button>
            </div>

            <div className={`wardrobe-worth-window ${wardrobeWorthOpen ? "is-open" : ""}`} aria-label="Wardrobe worth">
              <button type="button" className="ghost-button filter-close-button" onClick={() => setWardrobeWorthOpen(false)}>
                Close
              </button>
              <div className="wardrobe-worth-summary">
                <p className="eyebrow">Wardrobe worth</p>
                <h2>{formatCurrency(wardrobeWorth.totalValue)} / {formatCurrency(wardrobeWorth.totalRetailValue)}</h2>
                <span>{wardrobeWorth.totalCount} wardrobe pieces · paid / retail</span>
              </div>

              <div className="worth-chart">
                {wardrobeWorth.rows.map((row) => (
                  <div key={row.category} className="worth-row">
                    <div className="worth-row-header">
                      <strong>{row.category}</strong>
                      <span>{row.count} pieces · {formatCurrency(row.value)} / {formatCurrency(row.retailValue)}</span>
                    </div>
                    <div className="worth-bar-stack" aria-hidden="true">
                    <div className="worth-bar-track">
                      <div
                        className="worth-bar worth-bar-retail"
                        style={{ width: `${Math.max((row.retailValue / wardrobeWorth.maxValue) * 100, row.retailValue ? 8 : 0)}%` }}
                      />
                    </div>
                    <div className="worth-bar-track">
                      <div
                        className="worth-bar"
                        style={{ width: `${Math.max((row.value / wardrobeWorth.maxValue) * 100, row.value ? 8 : 0)}%` }}
                      />
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`wardrobe-saved-window ${wardrobeSavedOpen ? "is-open" : ""}`} aria-label="Saved outfits">
              <button type="button" className="ghost-button filter-close-button" onClick={() => setWardrobeSavedOpen(false)}>
                Close
              </button>
              <p className="eyebrow">Saved outfits</p>
              {renderSavedOutfitsContent()}
            </div>

            <div className={`wardrobe-manage-window ${wardrobeManageOpen ? "is-open" : ""}`} aria-label="Wardrobe management">
              <button type="button" className="ghost-button filter-close-button" onClick={() => setWardrobeManageOpen(false)}>
                Close
              </button>
              <button type="button" className="ghost-button" onClick={handleExportWardrobeImage}>
                Export wardrobe image
              </button>
              <button type="button" className="ghost-button" onClick={handleExportBackup}>
                Export backup
              </button>
              <button type="button" className="ghost-button" onClick={() => importBackupRef.current?.click()}>
                Import backup
              </button>
              <button type="button" className="ghost-button danger" onClick={handleResetToDefault}>
                Reset to default
              </button>
              <div className="filter-rules-editor">
                <div className="filter-rules-header">
                  <p className="eyebrow">Filter rules</p>
                  <button type="button" className="secondary-button" onClick={resetOutfitFilterRules}>
                    Reset filter rules
                  </button>
                </div>

                <div className="filter-rules-section">
                  <p className="eyebrow">Style</p>
                  {styleTagOptions.map((style) => (
                    <section key={style} className="filter-rule-group">
                      <strong>{style}</strong>
                      <div className="filter-rule-options">
                        {itemTypes.map((type) => {
                          const isSelected = visibleOutfitFilterRules.style[style]?.includes(type);

                          return (
                            <button
                              key={type}
                              type="button"
                              className={`list-toggle ${isSelected ? "is-active" : ""}`}
                              onClick={() => toggleOutfitFilterRule("style", style, type)}
                              aria-pressed={isSelected}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="filter-rules-section">
                  <p className="eyebrow">Climate</p>
                  {climateTagOptions.map((climate) => (
                    <section key={climate} className="filter-rule-group">
                      <strong>{climate}</strong>
                      <span>Include</span>
                      <div className="filter-rule-options">
                        {itemTypes.map((type) => {
                          const isSelected = visibleOutfitFilterRules.climateAllow[climate]?.includes(type);

                          return (
                            <button
                              key={type}
                              type="button"
                              className={`list-toggle ${isSelected ? "is-active" : ""}`}
                              onClick={() => toggleOutfitFilterRule("climateAllow", climate, type)}
                              aria-pressed={isSelected}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                      <span>Avoid</span>
                      <div className="filter-rule-options">
                        {itemTypes.map((type) => {
                          const isSelected = visibleOutfitFilterRules.climateBlock[climate]?.includes(type);

                          return (
                            <button
                              key={type}
                              type="button"
                              className={`list-toggle ${isSelected ? "is-active" : ""}`}
                              onClick={() => toggleOutfitFilterRule("climateBlock", climate, type)}
                              aria-pressed={isSelected}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>

            <input
              ref={importBackupRef}
              type="file"
              accept="application/json,.json"
              className="backup-file-input"
              onChange={handleImportBackup}
            />

            {hasActiveWardrobeFilters ? (
              <div className="active-filter-summary" aria-label="Active wardrobe filters">
                <div className="active-filter-chips">
                  {activeWardrobeFilterChips.map((filter) => (
                    <span key={filter.label} className="active-filter-chip">
                      <span>{filter.label}</span>
                      {filter.value}
                    </span>
                  ))}
                </div>
                <button type="button" className="ghost-button clear-filters-button" onClick={clearWardrobeFilters}>
                  Clear filters
                </button>
              </div>
            ) : null}

            <div className="wardrobe-grid">
              {visibleWardrobeItems.map((item) => {
                const isEquipped = Object.values(outfit).includes(item.id);

                return (
                  <article
                    key={item.id}
                    className={`wardrobe-card ${isEquipped ? "is-equipped" : ""} ${excluded[item.id] ? "is-excluded" : ""}`}
                  >
                    <button
                      type="button"
                      className={`exclude-toggle ${excluded[item.id] ? "is-active" : ""}`}
                      onClick={() => toggleExcluded(item.id)}
                      aria-label={excluded[item.id] ? "Include item in generation" : "Exclude item from generation"}
                    >
                      {excluded[item.id] ? "×" : ""}
                    </button>

                    <button type="button" className="wardrobe-preview" onClick={() => equipItem(item)}>
                      <img src={item.imageUrl} alt={item.name} style={getItemImageStyle(item)} />
                    </button>

                    <div className="wardrobe-meta">
                      <strong title={buildDisplayName(item)}>{buildDisplayName(item)}</strong>
                      <span className="wardrobe-description" title={buildWardrobeDescription(item)}>{buildWardrobeDescription(item)}</span>
                      <span title={`${item.color || "No color"} · Paid ${formatCurrency(item.value)} · Retail ${formatCurrency(item.retailValue)}`}>
                        {item.color || "No color"} · Paid {formatCurrency(item.value)} · Retail {formatCurrency(item.retailValue)}
                      </span>
                      <span title={normalizeList(item.list)}>
                        {normalizeList(item.list)}{normalizeQuantity(item.quantity) > 1 ? ` · Qty ${normalizeQuantity(item.quantity)}` : ""}{item.favorite ? " · Favorite" : ""}
                      </span>
                    </div>

                    <div className="card-actions">
                      <button type="button" className="ghost-button" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button type="button" className="ghost-button danger" onClick={() => handleDelete(item.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside ref={editorRef} className={`panel side-editor ${editingId ? "is-open" : ""}`}>
            <div className="panel-header side-editor-header">
              <div>
                <p className="eyebrow">Item editor</p>
                <h2>{editorTitle}</h2>
              </div>
              {editingId ? (
                <button type="button" className="ghost-button" onClick={cancelEdit}>
                  Close
                </button>
              ) : null}
            </div>

            {editorBody}
          </aside>
        </div>
        ) : null}

        {activePanel === "fitpics" ? (
        <section className="insights-stack">
          <div className="panel fitpics-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Fitpics</p>
                <h2>Fitpic archive</h2>
              </div>
              <label className="upload-button">
                Upload
                <input type="file" accept="image/*" multiple onChange={handleFitpicUpload} />
              </label>
            </div>

            {fitpics.length ? (
              <div className="fitpic-list">
                {fitpics.map((fitpic) => (
                  <article key={fitpic.id} className="fitpic-card">
                    <button
                      type="button"
                      className="fitpic-image-button"
                      onClick={() => setFitpicPreview(fitpic)}
                    >
                      <img src={fitpic.imageData} alt={fitpic.name} />
                    </button>
                    <div>
                      <strong>{fitpic.name}</strong>
                      <span>{new Date(fitpic.createdAt).toLocaleDateString()}</span>
                    </div>
                    <button type="button" className="ghost-button danger" onClick={() => deleteFitpic(fitpic.id)}>
                      Delete
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="editor-placeholder">
                <p>Upload fitpics and they will be collected here.</p>
              </div>
            )}
          </div>
        </section>
        ) : null}
        </div>
        </div>
        ) : null}

        {editorFloatingOpen && editingId ? (
          <aside className="panel floating-item-editor">
            <div className="panel-header side-editor-header">
              <div>
                <p className="eyebrow">Item editor</p>
                <h2>{editorTitle}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={cancelEdit}>
                Close
              </button>
            </div>

            {editorBody}
          </aside>
        ) : null}

        {confirmation ? (
          <div className="floating-backdrop confirm-backdrop" onClick={confirmation.onCancel}>
            <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
              <div>
                <p className="eyebrow">Confirm</p>
                <h2>{confirmation.title}</h2>
              </div>
              <p>{confirmation.message}</p>
              <div className="confirm-actions">
                <button type="button" className="ghost-button" onClick={confirmation.onCancel}>
                  Cancel
                </button>
                <button type="button" className="primary-button" onClick={confirmation.onConfirm}>
                  {confirmation.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {fitpicPreview ? (
          <div className="floating-backdrop fitpic-preview-backdrop" onClick={() => setFitpicPreview(null)}>
            <div className="fitpic-preview-overlay" onClick={(event) => event.stopPropagation()}>
              <img src={fitpicPreview.imageData} alt={fitpicPreview.name} />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
