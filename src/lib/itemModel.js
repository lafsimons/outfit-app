import {
  normalizeItemType,
  normalizeList,
  normalizeTagList,
  normalizeWeight,
  styleTagOptions
} from "./typeDefaults.js";
import { editableClimateTagOptions } from "./generation.js";

export const garmentTypes = [
  "Headwear",
  "Top",
  "Outerwear",
  "Bottom",
  "Footwear",
  "Dresses/Jumpsuits",
  "Accessory"
];

export const DEFAULT_WARDROBE_SORT = "newest";

export const emptyWardrobeFilters = {
  brand: "",
  type: "",
  garmentType: "",
  color: "",
  style: "",
  laundry: "",
  weight: "",
  list: "",
  favorite: ""
};

export function isWishlistItem(item) {
  const searchableMetadata = `${item.id ?? ""} ${item.name ?? ""}`.toLowerCase();
  return normalizeList(item.list) === "Wishlist" || searchableMetadata.includes("wishlist");
}

export function itemNeedsStyleWeightMappingMigration(originalItem, nextItem, areEditorValuesEqual) {
  return (
    normalizeWeight(originalItem.weight) !== nextItem.weight ||
    !areEditorValuesEqual(normalizeTagList(originalItem.styleTags, styleTagOptions), nextItem.styleTags)
  );
}

export function slugPart(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildBaseItemId(item) {
  const segments = [item.garmentType];

  if (item.garmentType === "Top" || item.garmentType === "Outerwear") {
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

export function createUniqueItemId(item, items, currentId = null) {
  const baseId = buildBaseItemId(item) || "item";
  let candidateId = baseId;
  let counter = 2;

  while (items.some((existing) => existing.id === candidateId && existing.id !== currentId)) {
    candidateId = `${baseId}_${counter}`;
    counter += 1;
  }

  return candidateId;
}

export function buildDisplayName(item) {
  const parts = [item.brand, item.name]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (parts.length) {
    return parts.join(" ");
  }

  return item.garmentType || "Untitled item";
}

export function hasNamingMetadata(item) {
  return [item.name, item.brand, item.type, item.color].some((value) => value?.trim());
}

export function getUniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function matchesMetadataFilter(value, filterValue) {
  if (!filterValue) {
    return true;
  }

  if (filterValue === "__none__") {
    return !value;
  }

  return value === filterValue;
}

export function normalizeItemColor(value) {
  const trimmed = value?.trim?.() ?? "";

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("#")) {
    return trimmed.toUpperCase();
  }

  return trimmed
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getNumericValue(value) {
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

function getImageStem(imageUrl) {
  const filename = stripViteHash(getImageFilename(imageUrl));
  const extensionIndex = filename.lastIndexOf(".");
  return extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
}

function getDefaultMetadataCorrection(item) {
  return defaultMetadataCorrectionById[item.id] ?? defaultMetadataCorrections[getImageStem(item.imageUrl)];
}

export function normalizeGarmentType(item) {
  if (item.garmentType === "Top" && item.layerType === "Outer") {
    return "Outerwear";
  }

  return garmentTypes.includes(item.garmentType) ? item.garmentType : "Top";
}

export function normalizeTimestamp(value) {
  const timestamp = typeof value === "string" ? value : "";
  return Number.isFinite(Date.parse(timestamp)) ? timestamp : "";
}

export function createFallbackItemTimestamp(baseMs, index) {
  return new Date(baseMs + index * 1000).toISOString();
}

export function getItemSortTimestamp(item, field = "createdAt") {
  const parsed = Date.parse(item?.[field] ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeImageAsset(value, fallbackSrc = "") {
  const asset = isRecord(value) ? value : {};
  const src = typeof asset.src === "string" ? asset.src : fallbackSrc;

  return {
    ...asset,
    src
  };
}

function normalizeImages(images, imageUrl) {
  const normalizedImages = isRecord(images) ? images : {};
  const preview = normalizeImageAsset(normalizedImages.preview, imageUrl);
  const thumbnail = normalizeImageAsset(normalizedImages.thumbnail, preview.src || imageUrl);

  return {
    ...normalizedImages,
    original: normalizeImageAsset(normalizedImages.original),
    preview,
    thumbnail
  };
}

export function normalizeItem(
  item,
  {
    fallbackCreatedAt,
    emptyForm,
    resolveImageUrl = (value) => value ?? "",
    normalizeImageFrameScale = (value) => value,
    normalizeImageScale = (value) => value,
    normalizeImageOffset = (value) => value,
    getNormalizedImageCrop = () => ({ x: 0, y: 0, width: 100, height: 100 })
  } = {}
) {
  const value = item.value ?? "";
  const retailValue = item.retailValue ?? "";
  const imageUrl = resolveImageUrl(item.imageUrl ?? item.img ?? item.images?.preview?.src ?? "");
  const correction = getDefaultMetadataCorrection({ ...item, imageUrl });
  const createdAt = normalizeTimestamp(item.createdAt) || fallbackCreatedAt || new Date().toISOString();
  const updatedAt = normalizeTimestamp(item.updatedAt) || createdAt;
  const imageCrop = getNormalizedImageCrop(item);
  const images = normalizeImages(item.images, imageUrl);
  const originalPreserved = item.originalPreserved === true;

  const normalizedItem = {
    ...emptyForm,
    ...item,
    ...correction,
    value,
    retailValue: correction?.retailValue ?? retailValue,
    imageUrl,
    images,
    originalPreserved,
    imageFrameScale: normalizeImageFrameScale(item.imageFrameScale),
    imageScale: normalizeImageScale(item.imageScale),
    imageOffsetX: normalizeImageOffset(item.imageOffsetX),
    imageOffsetY: normalizeImageOffset(item.imageOffsetY),
    imageCropX: imageCrop.x,
    imageCropY: imageCrop.y,
    imageCropWidth: imageCrop.width,
    imageCropHeight: imageCrop.height,
    favorite: Boolean(item.favorite),
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    garmentType: normalizeGarmentType({ ...emptyForm, ...item, ...correction }),
    weight: normalizeWeight(item.weight),
    styleTags: normalizeTagList(item.styleTags, styleTagOptions),
    climateTags: normalizeTagList(item.climateTags, editableClimateTagOptions),
    type: normalizeItemType(correction?.type ?? item.type ?? ""),
    color: normalizeItemColor(correction?.color ?? item.color ?? ""),
    list: normalizeList(correction?.list ?? item.list),
    createdAt,
    updatedAt
  };

  return normalizedItem;
}

export function itemNeedsImageContractMigration(originalItem, normalizedItem) {
  return (
    (originalItem.imageUrl ?? originalItem.img ?? originalItem.images?.preview?.src ?? "") !== normalizedItem.imageUrl ||
    JSON.stringify(isRecord(originalItem.images) ? originalItem.images : {}) !== JSON.stringify(normalizedItem.images) ||
    originalItem.originalPreserved !== normalizedItem.originalPreserved
  );
}

export function itemNeedsColorMigration(originalItem, normalizedItem) {
  return normalizeItemColor(originalItem.color) !== normalizedItem.color;
}

export function itemNeedsRetailMigration(originalItem, normalizedItem) {
  return originalItem.retailValue !== normalizedItem.retailValue;
}

export function itemNeedsFavoriteMigration(originalItem, normalizedItem) {
  return originalItem.favorite === undefined && normalizedItem.favorite === false;
}

export function itemNeedsQuantityMigration(originalItem, normalizedItem) {
  return originalItem.quantity === undefined || Math.max(1, Math.round(Number(originalItem.quantity) || 1)) !== normalizedItem.quantity;
}

export function itemNeedsWeightMigration(originalItem, normalizedItem) {
  return originalItem.weight === undefined || normalizeWeight(originalItem.weight) !== normalizedItem.weight;
}

export function itemNeedsGarmentTypeMigration(originalItem, normalizedItem) {
  return originalItem.garmentType !== normalizedItem.garmentType;
}

export function itemNeedsTagMigration(originalItem, normalizedItem) {
  return (
    !Array.isArray(originalItem.styleTags) ||
    normalizeTagList(originalItem.styleTags, styleTagOptions).length !== normalizedItem.styleTags.length
  );
}

export function itemNeedsClimateTagMigration(originalItem, normalizedItem) {
  return (
    !Array.isArray(originalItem.climateTags) ||
    normalizeTagList(originalItem.climateTags, editableClimateTagOptions).length !== normalizedItem.climateTags.length
  );
}

export function itemNeedsDefaultMetadataMigration(originalItem, normalizedItem) {
  const correction = getDefaultMetadataCorrection(normalizedItem);

  if (!correction) {
    return false;
  }

  return Object.keys(correction).some((key) => originalItem[key] !== normalizedItem[key]);
}

export function itemNeedsTimestampMigration(originalItem, normalizedItem) {
  return (
    normalizeTimestamp(originalItem.createdAt) !== normalizedItem.createdAt ||
    normalizeTimestamp(originalItem.updatedAt) !== normalizedItem.updatedAt
  );
}

export function normalizeWardrobeSort(value) {
  const allowed = [
    DEFAULT_WARDROBE_SORT,
    "oldest",
    "garmentType",
    "brand",
    "type",
    "value",
    "paidHigh",
    "paidLow",
    "retailHigh",
    "retailLow",
    "color"
  ];

  return allowed.includes(value) ? value : DEFAULT_WARDROBE_SORT;
}

export function formatCurrency(value) {
  if (value === "" || value === null || value === undefined) {
    return "No value";
  }

  return `${new Intl.NumberFormat("de-DE").format(getNumericValue(value))} €`;
}

export function getWorthCategory(item) {
  return garmentTypes.includes(item.garmentType) ? item.garmentType : "Accessory";
}
