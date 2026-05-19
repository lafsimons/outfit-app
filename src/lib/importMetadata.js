function normalizeTimestampLike(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }

  const timestamp = typeof value === "string" ? value : "";
  return Number.isFinite(Date.parse(timestamp)) ? timestamp : "";
}

function normalizeNonNegativeInteger(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed);
}

function normalizeStringField(value) {
  return typeof value === "string" ? value : "";
}

function normalizeRelinkStatus(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || "unknown";
}

export function normalizeImportMetadataFields(item, fallbackImportedAt = "") {
  return {
    importedAt: normalizeTimestampLike(item?.importedAt) || fallbackImportedAt,
    sourceOriginalFilename: normalizeStringField(item?.sourceOriginalFilename),
    sourceFileSize: normalizeNonNegativeInteger(item?.sourceFileSize),
    sourceImageWidth: normalizeNonNegativeInteger(item?.sourceImageWidth),
    sourceImageHeight: normalizeNonNegativeInteger(item?.sourceImageHeight),
    sourceLastModified: normalizeTimestampLike(item?.sourceLastModified),
    importSource: typeof item?.importSource === "string" ? item.importSource.trim() : "",
    sourceNamespace: normalizeStringField(item?.sourceNamespace),
    sourceRelativePath: normalizeStringField(item?.sourceRelativePath),
    relinkStatus: normalizeRelinkStatus(item?.relinkStatus)
  };
}

export async function readImageFileMetadata(
  file,
  {
    importSource = "file-upload",
    now = () => new Date().toISOString(),
    readFileAsDataUrl,
    loadImage
  } = {}
) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  return {
    importedAt: now(),
    sourceOriginalFilename: normalizeStringField(file?.name),
    sourceFileSize: normalizeNonNegativeInteger(file?.size),
    sourceImageWidth: normalizeNonNegativeInteger(image?.naturalWidth),
    sourceImageHeight: normalizeNonNegativeInteger(image?.naturalHeight),
    sourceLastModified: normalizeTimestampLike(file?.lastModified),
    importSource,
    sourceNamespace: "local-file",
    sourceRelativePath: normalizeStringField(file?.name),
    relinkStatus: "available"
  };
}
