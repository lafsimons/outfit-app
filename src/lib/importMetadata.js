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

export function normalizeImportMetadataFields(item, fallbackImportedAt = "") {
  return {
    importedAt: normalizeTimestampLike(item?.importedAt) || fallbackImportedAt,
    sourceOriginalFilename: typeof item?.sourceOriginalFilename === "string" ? item.sourceOriginalFilename : "",
    sourceFileSize: normalizeNonNegativeInteger(item?.sourceFileSize),
    sourceImageWidth: normalizeNonNegativeInteger(item?.sourceImageWidth),
    sourceImageHeight: normalizeNonNegativeInteger(item?.sourceImageHeight),
    sourceLastModified: normalizeTimestampLike(item?.sourceLastModified),
    importSource: typeof item?.importSource === "string" ? item.importSource.trim() : ""
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
    sourceOriginalFilename: typeof file?.name === "string" ? file.name : "",
    sourceFileSize: normalizeNonNegativeInteger(file?.size),
    sourceImageWidth: normalizeNonNegativeInteger(image?.naturalWidth),
    sourceImageHeight: normalizeNonNegativeInteger(image?.naturalHeight),
    sourceLastModified: normalizeTimestampLike(file?.lastModified),
    importSource
  };
}
