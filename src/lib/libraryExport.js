import { getImageFilename } from "./imagePresentation.js";

export const LIBRARY_EXPORT_COLUMNS = [
  "id",
  "itemUuid",
  "name",
  "brand",
  "garment",
  "type",
  "color",
  "status",
  "favorite",
  "size",
  "weight",
  "quantity",
  "styleTags",
  "climateTags",
  "description",
  "createdAt",
  "updatedAt",
  "imageFilename",
  "imageWidth",
  "imageHeight"
];

function normalizeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function escapeCsvCell(value) {
  const normalizedValue = normalizeCsvValue(value);

  if (!/[",\r\n]/.test(normalizedValue)) {
    return normalizedValue;
  }

  return `"${normalizedValue.replace(/"/g, "\"\"")}"`;
}

function joinTags(tags) {
  return Array.isArray(tags) ? tags.join("|") : "";
}

function getImageDimension(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(Math.round(parsed)) : "";
}

export function createLibraryExportRow(item = {}) {
  return {
    id: normalizeCsvValue(item.id),
    itemUuid: normalizeCsvValue(item.itemUuid),
    name: normalizeCsvValue(item.name),
    brand: normalizeCsvValue(item.brand),
    garment: normalizeCsvValue(item.garmentType),
    type: normalizeCsvValue(item.type),
    color: normalizeCsvValue(item.color),
    status: normalizeCsvValue(item.list),
    favorite: String(Boolean(item.favorite)),
    size: normalizeCsvValue(item.size),
    weight: normalizeCsvValue(item.weight),
    quantity: item.quantity === "" || item.quantity === null || item.quantity === undefined ? "" : String(item.quantity),
    styleTags: joinTags(item.styleTags),
    climateTags: joinTags(item.climateTags),
    description: normalizeCsvValue(item.description),
    createdAt: normalizeCsvValue(item.createdAt),
    updatedAt: normalizeCsvValue(item.updatedAt),
    imageFilename: normalizeCsvValue(getImageFilename(normalizeCsvValue(item.imageUrl))),
    imageWidth: getImageDimension(item.sourceImageWidth),
    imageHeight: getImageDimension(item.sourceImageHeight)
  };
}

export function serializeLibraryCsv(items = []) {
  const header = LIBRARY_EXPORT_COLUMNS.join(",");
  const rows = items.map((item) => {
    const exportRow = createLibraryExportRow(item);
    return LIBRARY_EXPORT_COLUMNS.map((column) => escapeCsvCell(exportRow[column])).join(",");
  });

  return [header, ...rows].join("\n");
}
