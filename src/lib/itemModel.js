import {
  normalizeItemType,
  normalizeStatus,
  normalizeTagList,
  normalizeWeight,
  styleTagOptions
} from "./typeDefaults.js";
import { editableClimateTagOptions } from "./generation.js";
import { normalizeImportMetadataFields } from "./importMetadata.js";

export const garmentTypes = [
  "Headwear",
  "Top",
  "Outerwear",
  "Bottom",
  "Footwear",
  "Dresses/Jumpsuits",
  "Accessory"
];

export function normalizeCollections(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();

  return value.reduce((normalized, entry) => {
    const collection = typeof entry === "string" ? entry.trim() : "";

    if (!collection || seen.has(collection)) {
      return normalized;
    }

    seen.add(collection);
    normalized.push(collection);
    return normalized;
  }, []);
}

export function isWishlistItem(item) {
  const searchableMetadata = `${item.id ?? ""} ${item.name ?? ""}`.toLowerCase();
  return normalizeStatus(item.status ?? item.list) === "Wishlist" || searchableMetadata.includes("wishlist");
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

export function createItemUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeItemUuid(value, createUuid = createItemUuid) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return createUuid();
}

function compareDuplicateItemCandidates(left, right) {
  const leftCreatedAt = Date.parse(left?.item?.createdAt ?? "");
  const rightCreatedAt = Date.parse(right?.item?.createdAt ?? "");
  const leftHasCreatedAt = Number.isFinite(leftCreatedAt);
  const rightHasCreatedAt = Number.isFinite(rightCreatedAt);

  if (leftHasCreatedAt && rightHasCreatedAt && leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  if (leftHasCreatedAt !== rightHasCreatedAt) {
    return leftHasCreatedAt ? -1 : 1;
  }

  return left.index - right.index;
}

export function auditDuplicateItemUuids(items = []) {
  const entriesByUuid = new Map();

  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const itemUuid = typeof item?.itemUuid === "string" ? item.itemUuid.trim() : "";

    if (!itemUuid) {
      return;
    }

    const currentEntries = entriesByUuid.get(itemUuid) ?? [];
    currentEntries.push({
      index,
      item
    });
    entriesByUuid.set(itemUuid, currentEntries);
  });

  return [...entriesByUuid.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([itemUuid, entries]) => {
      const orderedEntries = [...entries].sort(compareDuplicateItemCandidates);

      return {
        itemUuid,
        entries: orderedEntries,
        preservedEntry: orderedEntries[0],
        duplicateEntries: orderedEntries.slice(1)
      };
    });
}

function createUniqueResolvedItemUuid(usedItemUuids, createUuid) {
  let nextItemUuid = createUuid();

  while (usedItemUuids.has(nextItemUuid)) {
    nextItemUuid = createUuid();
  }

  usedItemUuids.add(nextItemUuid);
  return nextItemUuid;
}

export function createDuplicateItemUuid(itemUuid, createUuid = createItemUuid) {
  const usedItemUuids = new Set();
  const normalizedItemUuid = typeof itemUuid === "string" ? itemUuid.trim() : "";

  if (normalizedItemUuid) {
    usedItemUuids.add(normalizedItemUuid);
  }

  return createUniqueResolvedItemUuid(usedItemUuids, createUuid);
}

export function resolveDuplicateItemUuids(
  items = [],
  {
    createItemUuid: createUuid = createItemUuid
  } = {}
) {
  const duplicateGroups = auditDuplicateItemUuids(items);
  const usedItemUuids = new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => (typeof item?.itemUuid === "string" ? item.itemUuid.trim() : ""))
      .filter(Boolean)
  );

  if (!duplicateGroups.length) {
    return {
      items: Array.isArray(items) ? [...items] : [],
      duplicateGroups,
      changedItems: []
    };
  }

  const nextItems = Array.isArray(items) ? [...items] : [];
  const changedItems = [];

  duplicateGroups.forEach((group) => {
    group.duplicateEntries.forEach(({ index, item }) => {
      const nextItemUuid = createUniqueResolvedItemUuid(usedItemUuids, createUuid);
      const nextItem = {
        ...item,
        itemUuid: nextItemUuid
      };

      nextItems[index] = nextItem;
      changedItems.push({
        index,
        previousItemUuid: group.itemUuid,
        item: nextItem
      });
    });
  });

  return {
    items: nextItems,
    duplicateGroups,
    changedItems
  };
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
  const display = normalizeImageAsset(
    normalizedImages.display,
    normalizedImages.preview?.src ?? imageUrl
  );
  const preview = normalizeImageAsset(normalizedImages.preview, display.src || imageUrl);
  const thumbnail = normalizeImageAsset(normalizedImages.thumbnail, display.src || preview.src || imageUrl);

  return {
    ...normalizedImages,
    original: normalizeImageAsset(normalizedImages.original),
    display,
    preview,
    thumbnail
  };
}

function normalizeOrderedNumber(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.round(parsed));
}

function normalizeOptionalString(value, fallback = null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

function createWardrobeItemImageUuid(parentItemUuid, order = 0) {
  return `${parentItemUuid}:item-image:${order}`;
}

function createWardrobeImageAssetUuid(parentItemImageUuid, kind = "canonical", order = 0) {
  return `${parentItemImageUuid}:image-asset:${kind}:${order}`;
}

function buildLegacyWardrobeImageAsset(record) {
  return {
    imageUrl: record?.imageUrl,
    images: record?.images,
    importedAt: record?.importedAt,
    sourceOriginalFilename: record?.sourceOriginalFilename,
    sourceFileSize: record?.sourceFileSize,
    sourceImageWidth: record?.sourceImageWidth,
    sourceImageHeight: record?.sourceImageHeight,
    sourceLastModified: record?.sourceLastModified,
    importSource: record?.importSource,
    sourceNamespace: record?.sourceNamespace,
    sourceRelativePath: record?.sourceRelativePath,
    relinkStatus: record?.relinkStatus,
    sourceFileExtension: record?.sourceFileExtension,
    sourceMimeType: record?.sourceMimeType,
    sourceAspectRatio: record?.sourceAspectRatio,
    sourceOrientation: record?.sourceOrientation,
    sourceCapturedAt: record?.sourceCapturedAt,
    sourceOriginalCreatedAt: record?.sourceOriginalCreatedAt,
    sourceCameraMake: record?.sourceCameraMake,
    sourceCameraModel: record?.sourceCameraModel,
    sourceLensModel: record?.sourceLensModel,
    originalPreserved: record?.originalPreserved,
    archivalOriginalPreserved: record?.archivalOriginalPreserved
  };
}

function sortWardrobeItemImages(itemImages) {
  return [...itemImages].sort((left, right) => {
    const leftOrder = normalizeOrderedNumber(left?.order);
    const rightOrder = normalizeOrderedNumber(right?.order);

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return (left?.itemImageUuid ?? "").localeCompare(right?.itemImageUuid ?? "");
  });
}

function sortWardrobeImageAssets(assets) {
  return [...assets].sort((left, right) => {
    const leftOrder = normalizeOrderedNumber(left?.order);
    const rightOrder = normalizeOrderedNumber(right?.order);

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return (left?.assetUuid ?? "").localeCompare(right?.assetUuid ?? "");
  });
}

export function normalizeWardrobeImageAsset(
  asset,
  {
    fallbackOrder = 0,
    parentItemImageUuid = "",
    kind = "canonical",
    fallbackImportedAt = "",
    resolveImageUrl = (value) => value ?? ""
  } = {}
) {
  const normalizedAsset = isRecord(asset) ? asset : {};
  const order = normalizeOrderedNumber(normalizedAsset.order, fallbackOrder);
  const resolvedParentItemImageUuid = normalizeOptionalString(
    normalizedAsset.parentItemImageUuid,
    normalizeOptionalString(parentItemImageUuid, "")
  );
  const resolvedKind = normalizedAsset.kind === "derived" || kind === "derived" ? "derived" : "canonical";
  const imageUrl = resolveImageUrl(
    normalizedAsset.imageUrl
    ?? normalizedAsset.img
    ?? normalizedAsset.images?.display?.src
    ?? normalizedAsset.images?.preview?.src
    ?? ""
  );
  const importedAt = normalizeTimestamp(normalizedAsset.importedAt) || fallbackImportedAt;

  return {
    ...normalizedAsset,
    assetUuid:
      normalizeOptionalString(normalizedAsset.assetUuid)
      || createWardrobeImageAssetUuid(resolvedParentItemImageUuid, resolvedKind, order),
    kind: resolvedKind,
    parentItemImageUuid: resolvedParentItemImageUuid,
    parentAssetUuid: normalizeOptionalString(normalizedAsset.parentAssetUuid),
    order,
    imageUrl,
    images: normalizeImages(normalizedAsset.images, imageUrl),
    originalPreserved: normalizedAsset.originalPreserved === true,
    archivalOriginalPreserved: normalizedAsset.archivalOriginalPreserved === true,
    ...normalizeImportMetadataFields(normalizedAsset, importedAt)
  };
}

export function normalizeWardrobeItemImage(
  itemImage,
  {
    parentItemUuid = "",
    fallbackOrder = 0,
    fallbackImportedAt = "",
    resolveImageUrl = (value) => value ?? ""
  } = {}
) {
  const normalizedItemImage = isRecord(itemImage) ? itemImage : {};
  const order = normalizeOrderedNumber(normalizedItemImage.order, fallbackOrder);
  const resolvedParentItemUuid = normalizeOptionalString(
    normalizedItemImage.parentItemUuid,
    normalizeOptionalString(parentItemUuid, "")
  );
  const itemImageUuid =
    normalizeOptionalString(normalizedItemImage.itemImageUuid)
    || createWardrobeItemImageUuid(resolvedParentItemUuid, order);
  const canonicalAsset = normalizeWardrobeImageAsset(
    normalizedItemImage.canonicalAsset ?? buildLegacyWardrobeImageAsset(normalizedItemImage),
    {
      fallbackOrder: 0,
      parentItemImageUuid: itemImageUuid,
      kind: "canonical",
      fallbackImportedAt,
      resolveImageUrl
    }
  );
  const derivedAssets = sortWardrobeImageAssets(
    (Array.isArray(normalizedItemImage.derivedAssets) ? normalizedItemImage.derivedAssets : []).map((asset, index) =>
      normalizeWardrobeImageAsset(asset, {
        fallbackOrder: index + 1,
        parentItemImageUuid: itemImageUuid,
        kind: "derived",
        fallbackImportedAt: canonicalAsset.importedAt || fallbackImportedAt,
        resolveImageUrl
      })
    )
  );
  const activeImageAssetUuid = normalizeOptionalString(normalizedItemImage.activeImageAssetUuid);
  const resolvedActiveAsset = [canonicalAsset, ...derivedAssets].find(
    (asset) => asset.assetUuid === activeImageAssetUuid
  ) ?? canonicalAsset;

  return {
    ...normalizedItemImage,
    itemImageUuid,
    parentItemUuid: resolvedParentItemUuid,
    order,
    canonicalAsset,
    derivedAssets,
    activeImageAssetUuid: resolvedActiveAsset.assetUuid
  };
}

function getNormalizedWardrobeItemImages(
  item,
  {
    itemUuid = normalizeItemUuid(item?.itemUuid),
    fallbackImportedAt = "",
    resolveImageUrl = (value) => value ?? ""
  } = {}
) {
  const rawItemImages = Array.isArray(item?.itemImages) && item.itemImages.length
    ? item.itemImages
    : [buildLegacyWardrobeImageAsset(item)];

  return sortWardrobeItemImages(
    rawItemImages.map((itemImage, index) =>
      normalizeWardrobeItemImage(itemImage, {
        parentItemUuid: itemUuid,
        fallbackOrder: index,
        fallbackImportedAt,
        resolveImageUrl
      })
    )
  );
}

export function getWardrobeItemImages(item) {
  return getNormalizedWardrobeItemImages(item);
}

export function getActiveWardrobeItemImage(item) {
  const itemImages = getWardrobeItemImages(item);

  if (!itemImages.length) {
    return null;
  }

  const activeItemImageUuid = normalizeOptionalString(item?.activeItemImageUuid);
  return itemImages.find((itemImage) => itemImage.itemImageUuid === activeItemImageUuid) ?? itemImages[0];
}

export function getActiveWardrobeItemImageAsset(item) {
  const activeItemImage = getActiveWardrobeItemImage(item);

  if (!activeItemImage) {
    return null;
  }

  const activeImageAssetUuid = normalizeOptionalString(activeItemImage.activeImageAssetUuid);
  const candidateAssets = [activeItemImage.canonicalAsset, ...sortWardrobeImageAssets(activeItemImage.derivedAssets)];

  return candidateAssets.find((asset) => asset.assetUuid === activeImageAssetUuid) ?? activeItemImage.canonicalAsset;
}

export function getWardrobeImageAssetRenderSrc(asset, preferredTier = "display") {
  const normalizedAsset = isRecord(asset) ? asset : {};
  const preferredVariant = preferredTier === "thumbnail"
    ? normalizedAsset?.images?.thumbnail
    : normalizedAsset?.images?.display;
  const fallbackVariant = preferredTier === "thumbnail"
    ? normalizedAsset?.images?.display
    : normalizedAsset?.images?.thumbnail;

  return (
    preferredVariant?.src
    || normalizedAsset?.images?.preview?.src
    || fallbackVariant?.src
    || normalizedAsset?.imageUrl
    || ""
  );
}

export function getActiveWardrobeItemImageRenderSrc(item, preferredTier = "display") {
  return getWardrobeImageAssetRenderSrc(getActiveWardrobeItemImageAsset(item), preferredTier);
}

export function mirrorActiveWardrobeImageAssetToLegacyAliases(item) {
  const activeItemImage = getActiveWardrobeItemImage(item);
  const activeAsset = getActiveWardrobeItemImageAsset(item);
  const legacyImageUrl = typeof item?.imageUrl === "string" ? item.imageUrl : "";
  const legacyImages = normalizeImages(item?.images, legacyImageUrl);
  const mirroredImages = activeAsset ? normalizeImages(activeAsset.images, activeAsset.imageUrl) : legacyImages;

  return {
    ...item,
    itemImages: getWardrobeItemImages(item),
    activeItemImageUuid: activeItemImage?.itemImageUuid ?? null,
    imageUrl: activeAsset?.imageUrl ?? legacyImageUrl,
    images: mirroredImages,
    originalPreserved: activeAsset?.originalPreserved === true,
    archivalOriginalPreserved: activeAsset?.archivalOriginalPreserved === true
  };
}

export function normalizeItem(
  item,
  {
    createItemUuid: createUuid = createItemUuid,
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
  const imageUrl = resolveImageUrl(
    item.imageUrl ?? item.img ?? item.images?.display?.src ?? item.images?.preview?.src ?? ""
  );
  const correction = getDefaultMetadataCorrection({ ...item, imageUrl });
  const createdAt = normalizeTimestamp(item.createdAt) || fallbackCreatedAt || new Date().toISOString();
  const updatedAt = normalizeTimestamp(item.updatedAt) || createdAt;
  const imageCrop = getNormalizedImageCrop(item);
  const images = normalizeImages(item.images, imageUrl);
  const originalPreserved = item.originalPreserved === true;
  const archivalOriginalPreserved = item.archivalOriginalPreserved === true;
  const itemUuid = normalizeItemUuid(item.itemUuid, createUuid);
  const importMetadata = normalizeImportMetadataFields(item, createdAt);
  const itemImages = getNormalizedWardrobeItemImages(item, {
    itemUuid,
    fallbackImportedAt: importMetadata.importedAt,
    resolveImageUrl
  });
  const status = normalizeStatus(item.status ?? item.list ?? correction?.status ?? correction?.list);
  const collections = normalizeCollections(item.collections);

  const normalizedItem = mirrorActiveWardrobeImageAssetToLegacyAliases({
    ...emptyForm,
    ...item,
    ...correction,
    value,
    retailValue: correction?.retailValue ?? retailValue,
    imageUrl,
    images,
    itemImages,
    originalPreserved,
    archivalOriginalPreserved,
    description: typeof item.description === "string" ? item.description : "",
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
    status,
    list: status,
    collections,
    ...importMetadata,
    itemUuid,
    createdAt,
    updatedAt
  });

  return normalizedItem;
}

export function itemNeedsImageContractMigration(originalItem, normalizedItem) {
  const originalHasExplicitWardrobeImages = Array.isArray(originalItem?.itemImages)
    || Object.prototype.hasOwnProperty.call(originalItem ?? {}, "activeItemImageUuid");
  const originalUsesLegacyPreviewAlias = !isRecord(originalItem?.images)
    || !Object.prototype.hasOwnProperty.call(originalItem.images, "display");
  const normalizeMigrationImages = (images, fallbackImageUrl = "", stripCompatDisplay = false) => {
    const normalizedImages = normalizeImages(images, fallbackImageUrl);

    if (
      stripCompatDisplay
    ) {
      const nextImages = { ...normalizedImages };

      if (nextImages.display?.src === nextImages.preview?.src) {
        delete nextImages.display;
      }

      return nextImages;
    }

    return normalizedImages;
  };

  return (
    (originalItem.imageUrl ?? originalItem.img ?? originalItem.images?.preview?.src ?? "") !== normalizedItem.imageUrl ||
    JSON.stringify(
      normalizeMigrationImages(
        isRecord(originalItem.images) ? originalItem.images : {},
        originalItem.imageUrl ?? originalItem.img ?? originalItem.images?.preview?.src ?? "",
        originalUsesLegacyPreviewAlias
      )
    ) !== JSON.stringify(
      normalizeMigrationImages(normalizedItem.images, normalizedItem.imageUrl, originalUsesLegacyPreviewAlias)
    ) ||
    Boolean(originalItem.originalPreserved) !== normalizedItem.originalPreserved ||
    Boolean(originalItem.archivalOriginalPreserved) !== normalizedItem.archivalOriginalPreserved ||
    (
      originalHasExplicitWardrobeImages && (
        JSON.stringify(Array.isArray(originalItem?.itemImages) ? originalItem.itemImages : []) !== JSON.stringify(normalizedItem.itemImages) ||
        normalizeOptionalString(originalItem?.activeItemImageUuid) !== normalizedItem.activeItemImageUuid
      )
    )
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

export function itemNeedsDescriptionMigration(originalItem, normalizedItem) {
  return (originalItem?.description ?? "") !== normalizedItem.description;
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

export function itemNeedsItemUuidMigration(originalItem, normalizedItem) {
  return originalItem?.itemUuid !== normalizedItem.itemUuid;
}

export function itemNeedsImportMetadataMigration(originalItem, normalizedItem) {
  return (
    originalItem?.importedAt !== normalizedItem.importedAt ||
    originalItem?.sourceOriginalFilename !== normalizedItem.sourceOriginalFilename ||
    originalItem?.sourceFileSize !== normalizedItem.sourceFileSize ||
    originalItem?.sourceImageWidth !== normalizedItem.sourceImageWidth ||
    originalItem?.sourceImageHeight !== normalizedItem.sourceImageHeight ||
    originalItem?.sourceLastModified !== normalizedItem.sourceLastModified ||
    originalItem?.importSource !== normalizedItem.importSource ||
    originalItem?.sourceNamespace !== normalizedItem.sourceNamespace ||
    originalItem?.sourceRelativePath !== normalizedItem.sourceRelativePath ||
    originalItem?.relinkStatus !== normalizedItem.relinkStatus
  );
}

export function formatCurrency(value) {
  if (value === "" || value === null || value === undefined) {
    return "No value";
  }

  return `${new Intl.NumberFormat("de-DE").format(getNumericValue(value))} €`;
}

export function getWardrobePreviewMetadata(item) {
  const quantity = Math.max(1, Math.round(Number(item?.quantity) || 1));
  const entries = [
    ["Garment", normalizeGarmentType(item ?? {})],
    ["Type", item?.type?.trim?.() ?? item?.type ?? ""],
    ["Color", item?.color?.trim?.() ?? item?.color ?? ""],
    ["Size", item?.size?.trim?.() ?? item?.size ?? ""],
    ["Status", normalizeStatus(item?.status ?? item?.list)],
    ["Paid", item?.value === "" || item?.value === null || item?.value === undefined ? "" : formatCurrency(item.value)],
    ["Retail", item?.retailValue === "" || item?.retailValue === null || item?.retailValue === undefined ? "" : formatCurrency(item.retailValue)],
    ["Quantity", quantity > 1 ? String(quantity) : ""],
    ["Collections", normalizeCollections(item?.collections).join(", ")]
  ];

  return entries
    .filter(([, value]) => value)
    .map(([label, value]) => ({
      label,
      value
    }));
}

export function getWorthCategory(item) {
  return garmentTypes.includes(item.garmentType) ? item.garmentType : "Accessory";
}
