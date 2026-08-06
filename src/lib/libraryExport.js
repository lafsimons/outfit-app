import { getImageFilename } from "./imagePresentation.js";

export const LIBRARY_EXPORT_COLUMNS = [
  "id",
  "itemUuid",
  "name",
  "brand",
  "garment",
  "layerType",
  "accessorySlot",
  "type",
  "color",
  "status",
  "list",
  "favorite",
  "size",
  "weight",
  "quantity",
  "paid",
  "worth",
  "collections",
  "styleTags",
  "climateTags",
  "description",
  "importedAt",
  "sourceOriginalFilename",
  "sourceFileSize",
  "sourceImageWidth",
  "sourceImageHeight",
  "sourceLastModified",
  "importSource",
  "sourceNamespace",
  "sourceRelativePath",
  "relinkStatus",
  "sourceFileExtension",
  "sourceMimeType",
  "sourceAspectRatio",
  "sourceOrientation",
  "sourceCapturedAt",
  "sourceOriginalCreatedAt",
  "sourceCameraMake",
  "sourceCameraModel",
  "sourceLensModel",
  "originalPreserved",
  "archivalOriginalPreserved",
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

function getPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

export function createLibraryExportRow(item = {}) {
  return {
    id: normalizeCsvValue(item.id),
    itemUuid: normalizeCsvValue(item.itemUuid),
    name: normalizeCsvValue(item.name),
    brand: normalizeCsvValue(item.brand),
    garment: normalizeCsvValue(item.garmentType),
    layerType: normalizeCsvValue(item.layerType),
    accessorySlot: normalizeCsvValue(item.accessorySlot),
    type: normalizeCsvValue(item.type),
    color: normalizeCsvValue(item.color),
    status: normalizeCsvValue(item.status ?? item.list),
    list: normalizeCsvValue(item.list ?? item.status),
    favorite: String(Boolean(item.favorite)),
    size: normalizeCsvValue(item.size),
    weight: normalizeCsvValue(item.weight),
    quantity: item.quantity === "" || item.quantity === null || item.quantity === undefined ? "" : String(item.quantity),
    paid: normalizeCsvValue(item.value),
    worth: normalizeCsvValue(item.retailValue),
    collections: joinTags(item.collections),
    styleTags: joinTags(item.styleTags),
    climateTags: joinTags(item.climateTags),
    description: normalizeCsvValue(item.description),
    importedAt: normalizeCsvValue(item.importedAt),
    sourceOriginalFilename: normalizeCsvValue(item.sourceOriginalFilename),
    sourceFileSize: getPositiveNumber(item.sourceFileSize),
    sourceImageWidth: getImageDimension(item.sourceImageWidth),
    sourceImageHeight: getImageDimension(item.sourceImageHeight),
    sourceLastModified: normalizeCsvValue(item.sourceLastModified),
    importSource: normalizeCsvValue(item.importSource),
    sourceNamespace: normalizeCsvValue(item.sourceNamespace),
    sourceRelativePath: normalizeCsvValue(item.sourceRelativePath),
    relinkStatus: normalizeCsvValue(item.relinkStatus),
    sourceFileExtension: normalizeCsvValue(item.sourceFileExtension),
    sourceMimeType: normalizeCsvValue(item.sourceMimeType),
    sourceAspectRatio: getPositiveNumber(item.sourceAspectRatio),
    sourceOrientation: normalizeCsvValue(item.sourceOrientation),
    sourceCapturedAt: normalizeCsvValue(item.sourceCapturedAt),
    sourceOriginalCreatedAt: normalizeCsvValue(item.sourceOriginalCreatedAt),
    sourceCameraMake: normalizeCsvValue(item.sourceCameraMake),
    sourceCameraModel: normalizeCsvValue(item.sourceCameraModel),
    sourceLensModel: normalizeCsvValue(item.sourceLensModel),
    originalPreserved: String(Boolean(item.originalPreserved)),
    archivalOriginalPreserved: String(Boolean(item.archivalOriginalPreserved)),
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
