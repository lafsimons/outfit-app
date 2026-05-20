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

function normalizeNonNegativeNumber(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function normalizeStringField(value) {
  return typeof value === "string" ? value : "";
}

function normalizeRelinkStatus(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || "unknown";
}

function getFileExtension(filename) {
  const normalizedFilename = normalizeStringField(filename).trim();

  if (!normalizedFilename) {
    return "";
  }

  const extension = normalizedFilename.includes(".")
    ? normalizedFilename.split(".").pop()
    : normalizedFilename.replace(/^\.+/, "");

  return extension ? extension.toLowerCase() : "";
}

function getOrientation(width, height) {
  if (!width || !height) {
    return "unknown";
  }

  if (width === height) {
    return "square";
  }

  return width > height ? "landscape" : "portrait";
}

function getAspectRatio(width, height) {
  if (!width || !height) {
    return 0;
  }

  return Number((width / height).toFixed(6));
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

export function normalizeExtendedImageMetadataFields(item) {
  return {
    sourceFileExtension: getFileExtension(item?.sourceFileExtension || item?.sourceOriginalFilename),
    sourceMimeType: normalizeStringField(item?.sourceMimeType),
    sourceAspectRatio: normalizeNonNegativeNumber(item?.sourceAspectRatio),
    sourceOrientation: normalizeStringField(item?.sourceOrientation).trim() || "unknown",
    sourceCapturedAt: normalizeTimestampLike(item?.sourceCapturedAt),
    sourceOriginalCreatedAt: normalizeTimestampLike(item?.sourceOriginalCreatedAt),
    sourceCameraMake: normalizeStringField(item?.sourceCameraMake),
    sourceCameraModel: normalizeStringField(item?.sourceCameraModel),
    sourceLensModel: normalizeStringField(item?.sourceLensModel)
  };
}

export async function readImageFileMetadata(
  file,
  {
    importSource = "file-upload",
    now = () => new Date().toISOString(),
    readFileAsDataUrl,
    loadImage,
    readAdditionalMetadata = async () => ({})
  } = {}
) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const width = normalizeNonNegativeInteger(image?.naturalWidth);
  const height = normalizeNonNegativeInteger(image?.naturalHeight);
  const rawAdditionalMetadata = await readAdditionalMetadata(file, {
    dataUrl,
    image,
    width,
    height
  });
  const additionalMetadata = normalizeExtendedImageMetadataFields(rawAdditionalMetadata);

  return {
    importedAt: now(),
    sourceOriginalFilename: normalizeStringField(file?.name),
    sourceFileSize: normalizeNonNegativeInteger(file?.size),
    sourceImageWidth: width,
    sourceImageHeight: height,
    sourceLastModified: normalizeTimestampLike(file?.lastModified),
    importSource,
    sourceNamespace: "local-file",
    sourceRelativePath: normalizeStringField(file?.name),
    relinkStatus: "available",
    sourceFileExtension: additionalMetadata.sourceFileExtension || getFileExtension(file?.name),
    sourceMimeType: additionalMetadata.sourceMimeType || normalizeStringField(file?.type),
    sourceAspectRatio: additionalMetadata.sourceAspectRatio || getAspectRatio(width, height),
    sourceOrientation: additionalMetadata.sourceOrientation !== "unknown"
      ? additionalMetadata.sourceOrientation
      : getOrientation(width, height),
    sourceCapturedAt: additionalMetadata.sourceCapturedAt,
    sourceOriginalCreatedAt: additionalMetadata.sourceOriginalCreatedAt,
    sourceCameraMake: additionalMetadata.sourceCameraMake,
    sourceCameraModel: additionalMetadata.sourceCameraModel,
    sourceLensModel: additionalMetadata.sourceLensModel
  };
}
