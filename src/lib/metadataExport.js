import { buildDisplayName } from "./itemModel.js";
import { getFitpicImages, getPrimaryFitpicImage } from "./fitpics.js";
import { resolveFitpicLinkedItems } from "./fitpicEditorModel.js";

const savedOutfitSlotOrder = [
  "Headwear",
  "TopInner",
  "TopOuter",
  "Bottom",
  "Footwear",
  "Glasses",
  "Neck",
  "LeftHand",
  "RightHand",
  "Bag",
  "Belt"
];

const savedOutfitAccessorySlots = ["Glasses", "Neck", "LeftHand", "RightHand", "Bag", "Belt"];

const savedOutfitPrimarySlotFields = [
  { exportKey: "headwear", slot: "Headwear" },
  { exportKey: "top", slot: "TopInner" },
  { exportKey: "outerLayer", slot: "TopOuter" },
  { exportKey: "bottom", slot: "Bottom" },
  { exportKey: "footwear", slot: "Footwear" }
];

export const SAVED_OUTFIT_EXPORT_COLUMNS = [
  "id",
  "outfitUuid",
  "title",
  "description",
  "tags",
  "createdAt",
  "updatedAt",
  "favorite",
  "layering",
  "generationMode",
  "weather",
  "season",
  "context",
  "includedItemIds",
  "includedItemUuids",
  "includedItemNames",
  "headwearItemId",
  "headwearItemUuid",
  "headwearItemName",
  "topItemId",
  "topItemUuid",
  "topItemName",
  "outerLayerItemId",
  "outerLayerItemUuid",
  "outerLayerItemName",
  "bottomItemId",
  "bottomItemUuid",
  "bottomItemName",
  "footwearItemId",
  "footwearItemUuid",
  "footwearItemName",
  "accessories",
  "previewImageUrl",
  "futureImageLink"
];

export const FITPIC_EXPORT_COLUMNS = [
  "id",
  "fitpicUuid",
  "title",
  "description",
  "tags",
  "createdAt",
  "importedAt",
  "updatedAt",
  "favorite",
  "fitDate",
  "linkedItemIds",
  "linkedItemUuids",
  "linkedItemNames",
  "primaryImageUrl",
  "imageCount",
  "imageUrls",
  "futureImageLink"
];

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function escapeCsvCell(value) {
  const normalizedValue = normalizeCsvValue(value);

  if (!/[",\r\n]/.test(normalizedValue)) {
    return normalizedValue;
  }

  return `"${normalizedValue.replace(/"/g, "\"\"")}"`;
}

export function sanitizeImageReference(value) {
  const normalizedValue = normalizeString(
    value && typeof value === "object" && !Array.isArray(value)
      ? value.src
      : value
  );

  if (!normalizedValue || /^data:/i.test(normalizedValue) || /^blob:/i.test(normalizedValue)) {
    return "";
  }

  return normalizedValue;
}

function joinCsvArray(values = []) {
  return Array.isArray(values) ? values.map(normalizeCsvValue).filter(Boolean).join("|") : "";
}

function uniqueValues(values = []) {
  const seen = new Set();
  const normalized = [];

  values.forEach((value) => {
    const normalizedValue = normalizeString(value);

    if (!normalizedValue || seen.has(normalizedValue)) {
      return;
    }

    seen.add(normalizedValue);
    normalized.push(normalizedValue);
  });

  return normalized;
}

function getItemsById(items = []) {
  return Object.fromEntries(
    items
      .filter((item) => typeof item?.id === "string" && item.id.trim())
      .map((item) => [item.id, item])
  );
}

function getOutfitSlotEntry(savedOutfit = {}, slot, itemsById = {}) {
  const itemId = normalizeString(savedOutfit?.outfit?.[slot]);
  const item = itemId ? itemsById[itemId] ?? null : null;
  const itemUuid = normalizeString(savedOutfit?.outfitItemUuids?.[slot]) || normalizeString(item?.itemUuid);
  const itemName = item ? buildDisplayName(item) : itemId || itemUuid ? "Missing wardrobe item" : "";

  return {
    slot,
    itemId,
    itemUuid,
    itemName,
    item
  };
}

function getSavedOutfitItemEntries(savedOutfit = {}, items = []) {
  const itemsById = getItemsById(items);
  return savedOutfitSlotOrder
    .map((slot) => getOutfitSlotEntry(savedOutfit, slot, itemsById))
    .filter((entry) => entry.itemId || entry.itemUuid);
}

function getSavedOutfitPreviewImageUrl(savedOutfit = {}, itemEntries = []) {
  const directPreview = sanitizeImageReference(savedOutfit?.previewImageUrl);
  const directImage = sanitizeImageReference(savedOutfit?.imageUrl);
  const directRender = sanitizeImageReference(savedOutfit?.renderUrl);

  if (directPreview) return directPreview;
  if (directImage) return directImage;
  if (directRender) return directRender;

  const itemImage = itemEntries
    .map((entry) => sanitizeImageReference(entry.item?.imageUrl))
    .find(Boolean);

  return itemImage || "";
}

export function createSavedOutfitExportRecord(savedOutfit = {}, items = []) {
  const itemEntries = getSavedOutfitItemEntries(savedOutfit, items);
  const primaryEntries = Object.fromEntries(
    savedOutfitPrimarySlotFields.map(({ exportKey, slot }) => [exportKey, getOutfitSlotEntry(savedOutfit, slot, getItemsById(items))])
  );
  const accessories = savedOutfitAccessorySlots
    .map((slot) => getOutfitSlotEntry(savedOutfit, slot, getItemsById(items)))
    .filter((entry) => entry.itemId || entry.itemUuid)
    .map((entry) => ({
      slot: entry.slot,
      itemId: entry.itemId,
      itemUuid: entry.itemUuid,
      itemName: entry.itemName
    }));

  return {
    id: savedOutfit?.id ?? "",
    outfitUuid: savedOutfit?.outfitUuid ?? "",
    title: savedOutfit?.name ?? "",
    description: savedOutfit?.description ?? "",
    tags: Array.isArray(savedOutfit?.tags) ? savedOutfit.tags : [],
    createdAt: savedOutfit?.createdAt ?? "",
    updatedAt: savedOutfit?.updatedAt ?? "",
    favorite: Boolean(savedOutfit?.favorite),
    layering: Boolean(savedOutfit?.layering),
    generationMode: "",
    weather: "",
    season: "",
    context: "",
    includedItemIds: itemEntries.map((entry) => entry.itemId).filter(Boolean),
    includedItemUuids: itemEntries.map((entry) => entry.itemUuid).filter(Boolean),
    includedItemNames: itemEntries.map((entry) => entry.itemName).filter(Boolean),
    headwearItemId: primaryEntries.headwear.itemId,
    headwearItemUuid: primaryEntries.headwear.itemUuid,
    headwearItemName: primaryEntries.headwear.itemName,
    topItemId: primaryEntries.top.itemId,
    topItemUuid: primaryEntries.top.itemUuid,
    topItemName: primaryEntries.top.itemName,
    outerLayerItemId: primaryEntries.outerLayer.itemId,
    outerLayerItemUuid: primaryEntries.outerLayer.itemUuid,
    outerLayerItemName: primaryEntries.outerLayer.itemName,
    bottomItemId: primaryEntries.bottom.itemId,
    bottomItemUuid: primaryEntries.bottom.itemUuid,
    bottomItemName: primaryEntries.bottom.itemName,
    footwearItemId: primaryEntries.footwear.itemId,
    footwearItemUuid: primaryEntries.footwear.itemUuid,
    footwearItemName: primaryEntries.footwear.itemName,
    accessories,
    previewImageUrl: getSavedOutfitPreviewImageUrl(savedOutfit, itemEntries),
    futureImageLink: ""
  };
}

function getFitpicImageCandidates(entity = {}) {
  return uniqueValues([
    entity?.primaryImageUrl,
    entity?.imageUrl,
    ...(Array.isArray(entity?.imageUrls) ? entity.imageUrls : []),
    entity?.images?.original,
    entity?.images?.display,
    entity?.images?.preview,
    entity?.images?.thumbnail,
    entity?.sourceRelativePath,
    entity?.sourceOriginalFilename
  ].map(sanitizeImageReference));
}

function getFitpicExportImages(fitpic = {}) {
  const rawFitpicImages = Array.isArray(fitpic?.fitpicImages) ? fitpic.fitpicImages : [];

  if (rawFitpicImages.length > 0) {
    return [...rawFitpicImages]
      .map((fitpicImage, index) => ({
        ...fitpicImage,
        fitpicImageUuid: normalizeString(fitpicImage?.fitpicImageUuid),
        order: Number.isFinite(Number(fitpicImage?.order)) ? Number(fitpicImage.order) : index
      }))
      .sort((left, right) => left.order - right.order);
  }

  return getFitpicImages(fitpic);
}

function getFitpicPrimaryExportImage(fitpic = {}, fitpicImages = []) {
  const requestedPrimaryImageUuid = normalizeString(fitpic?.primaryImageUuid);

  if (requestedPrimaryImageUuid) {
    const requestedImage = fitpicImages.find((fitpicImage) => normalizeString(fitpicImage?.fitpicImageUuid) === requestedPrimaryImageUuid);

    if (requestedImage) {
      return requestedImage;
    }
  }

  return getPrimaryFitpicImage(fitpic) ?? fitpicImages[0] ?? null;
}

function getFitpicImageRecordCount(fitpic = {}, fitpicImages = []) {
  if (fitpicImages.length > 0) {
    return fitpicImages.length;
  }

  const directImageReferences = [
    fitpic?.primaryImageUrl,
    fitpic?.imageUrl,
    ...(Array.isArray(fitpic?.imageUrls) ? fitpic.imageUrls : []),
    fitpic?.sourceRelativePath,
    fitpic?.sourceOriginalFilename,
    fitpic?.images?.original,
    fitpic?.images?.display,
    fitpic?.images?.preview,
    fitpic?.images?.thumbnail,
    fitpic?.imageData
  ].map(normalizeString).filter(Boolean);

  return directImageReferences.length > 0 ? 1 : 0;
}

export function createFitpicExportRecord(fitpic = {}, items = []) {
  const linkedItemEntries = resolveFitpicLinkedItems(fitpic?.linkedItemUuids, fitpic?.linkedItemIds, items);
  const fitpicImages = getFitpicExportImages(fitpic);
  const primaryFitpicImage = getFitpicPrimaryExportImage(fitpic, fitpicImages);
  const primaryImageUrl = getFitpicImageCandidates(primaryFitpicImage).find(Boolean)
    || getFitpicImageCandidates(fitpic).find(Boolean)
    || "";
  const fitpicImageUrls = uniqueValues([
    primaryImageUrl,
    ...(fitpicImages.flatMap((fitpicImage) => getFitpicImageCandidates(fitpicImage))),
    ...getFitpicImageCandidates(fitpic)
  ]);

  return {
    id: fitpic?.id ?? "",
    fitpicUuid: fitpic?.fitpicUuid ?? "",
    title: fitpic?.name ?? "",
    description: fitpic?.description ?? "",
    tags: Array.isArray(fitpic?.tags) ? fitpic.tags : [],
    createdAt: fitpic?.createdAt ?? "",
    importedAt: fitpic?.importedAt ?? "",
    updatedAt: fitpic?.updatedAt ?? "",
    favorite: Boolean(fitpic?.favorite),
    fitDate: fitpic?.fitDate ?? "",
    linkedItemIds: linkedItemEntries.map((entry) => entry.itemId).filter(Boolean),
    linkedItemUuids: linkedItemEntries.map((entry) => entry.itemUuid).filter(Boolean),
    linkedItemNames: linkedItemEntries.map((entry) => entry.label).filter(Boolean),
    primaryImageUrl,
    imageCount: getFitpicImageRecordCount(fitpic, fitpicImages),
    imageUrls: fitpicImageUrls,
    futureImageLink: ""
  };
}

export function createSavedOutfitCsvRow(savedOutfit = {}, items = []) {
  const record = createSavedOutfitExportRecord(savedOutfit, items);

  return {
    ...record,
    favorite: String(record.favorite),
    layering: String(record.layering),
    tags: joinCsvArray(record.tags),
    includedItemIds: joinCsvArray(record.includedItemIds),
    includedItemUuids: joinCsvArray(record.includedItemUuids),
    includedItemNames: joinCsvArray(record.includedItemNames),
    accessories: joinCsvArray(record.accessories.map((entry) => `${entry.slot}: ${entry.itemName || entry.itemUuid || entry.itemId}`))
  };
}

export function createFitpicCsvRow(fitpic = {}, items = []) {
  const record = createFitpicExportRecord(fitpic, items);

  return {
    ...record,
    favorite: String(record.favorite),
    tags: joinCsvArray(record.tags),
    linkedItemIds: joinCsvArray(record.linkedItemIds),
    linkedItemUuids: joinCsvArray(record.linkedItemUuids),
    linkedItemNames: joinCsvArray(record.linkedItemNames),
    imageCount: String(record.imageCount),
    imageUrls: joinCsvArray(record.imageUrls)
  };
}

function serializeCsv(rows = [], columns = []) {
  const header = columns.join(",");
  const csvRows = rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(","));
  return [header, ...csvRows].join("\n");
}

export function serializeSavedOutfitsCsv(savedOutfits = [], items = []) {
  return serializeCsv(
    savedOutfits.map((savedOutfit) => createSavedOutfitCsvRow(savedOutfit, items)),
    SAVED_OUTFIT_EXPORT_COLUMNS
  );
}

export function serializeFitpicsCsv(fitpics = [], items = []) {
  return serializeCsv(
    fitpics.map((fitpic) => createFitpicCsvRow(fitpic, items)),
    FITPIC_EXPORT_COLUMNS
  );
}

export function serializeSavedOutfitsJson(savedOutfits = [], items = []) {
  return JSON.stringify(savedOutfits.map((savedOutfit) => createSavedOutfitExportRecord(savedOutfit, items)), null, 2);
}

export function serializeFitpicsJson(fitpics = [], items = []) {
  return JSON.stringify(fitpics.map((fitpic) => createFitpicExportRecord(fitpic, items)), null, 2);
}

export function getExportFilename(kind, format, date = new Date()) {
  const normalizedDate = date instanceof Date ? date : new Date(date);
  const dayStamp = Number.isNaN(normalizedDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : normalizedDate.toISOString().slice(0, 10);

  return `oa-${kind}-export-${dayStamp}.${format}`;
}

export function downloadExportFile(contents, { filename, mimeType }) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
