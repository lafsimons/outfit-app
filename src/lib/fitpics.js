import { normalizeImportMetadataFields, normalizeExtendedImageMetadataFields, readImageFileMetadata } from "./importMetadata.js";

function normalizeTimestampLike(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }

  const timestamp = typeof value === "string" ? value : "";
  return Number.isFinite(Date.parse(timestamp)) ? timestamp : "";
}

function normalizeStringField(value) {
  return typeof value === "string" ? value : "";
}

function normalizeImageVariantString(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeStringField(value.src);
  }

  return "";
}

function normalizeOptionalTimestamp(value) {
  const timestamp = normalizeTimestampLike(value);
  return timestamp || null;
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen = new Set();

  return tags.reduce((normalized, tag) => {
    const trimmed = typeof tag === "string" ? tag.trim() : "";

    if (!trimmed) {
      return normalized;
    }

    const key = trimmed.toLowerCase();

    if (seen.has(key)) {
      return normalized;
    }

    seen.add(key);
    normalized.push(trimmed);
    return normalized;
  }, []);
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();

  return values.reduce((normalized, value) => {
    const trimmed = normalizeStringField(value).trim();

    if (!trimmed || seen.has(trimmed)) {
      return normalized;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
    return normalized;
  }, []);
}

function normalizeNullableString(value) {
  const trimmed = normalizeStringField(value).trim();
  return trimmed || null;
}

function normalizeImages(images, imageData) {
  const currentImages = images && typeof images === "object" && !Array.isArray(images) ? images : {};
  const display = normalizeImageVariantString(currentImages.display) || normalizeImageVariantString(currentImages.preview) || normalizeStringField(imageData);
  const preview = normalizeImageVariantString(currentImages.preview) || display || normalizeStringField(imageData);

  return {
    ...currentImages,
    original: normalizeImageVariantString(currentImages.original),
    display,
    preview,
    thumbnail: normalizeImageVariantString(currentImages.thumbnail)
  };
}

function normalizeOrder(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.round(numericValue));
}

function normalizeOptionalString(value) {
  const trimmed = normalizeStringField(value).trim();
  return trimmed || "";
}

function normalizeImportedImageAssets(value) {
  if (typeof value === "string") {
    return {
      originalPreserved: false,
      archivalOriginalPreserved: false,
      original: { src: "", mimeType: "", fileSize: 0, width: 0, height: 0 },
      display: { src: value, mimeType: "", fileSize: 0, width: 0, height: 0 },
      thumbnail: { src: value, mimeType: "", fileSize: 0, width: 0, height: 0 }
    };
  }

  const record = value && typeof value === "object" ? value : {};
  const displaySrc = normalizeImageVariantString(record.display) || normalizeImageVariantString(record.preview);
  const originalSrc = normalizeImageVariantString(record.original);
  const thumbnailSrc = normalizeImageVariantString(record.thumbnail) || displaySrc;

  return {
    originalPreserved: record.originalPreserved === true,
    archivalOriginalPreserved: record.archivalOriginalPreserved === true,
    original: {
      src: originalSrc,
      mimeType: normalizeStringField(record.original?.mimeType),
      fileSize: Number(record.original?.fileSize) || 0,
      width: Number(record.original?.width) || 0,
      height: Number(record.original?.height) || 0
    },
    display: {
      src: displaySrc,
      mimeType: normalizeStringField(record.display?.mimeType),
      fileSize: Number(record.display?.fileSize) || 0,
      width: Number(record.display?.width) || 0,
      height: Number(record.display?.height) || 0
    },
    thumbnail: {
      src: thumbnailSrc,
      mimeType: normalizeStringField(record.thumbnail?.mimeType),
      fileSize: Number(record.thumbnail?.fileSize) || 0,
      width: Number(record.thumbnail?.width) || 0,
      height: Number(record.thumbnail?.height) || 0
    }
  };
}

export function createFitpicUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `fitpic_uuid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createFitpicImageUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `fitpic_image_uuid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getFitpicNameFromFilename(filename) {
  const normalizedFilename = normalizeStringField(filename).trim();

  if (!normalizedFilename) {
    return "Untitled fitpic";
  }

  return normalizedFilename.replace(/\.[^.]+$/, "") || normalizedFilename;
}

export function normalizeFitpicImage(
  fitpicImage,
  {
    createUuid = createFitpicImageUuid,
    fallbackTimestamp = new Date().toISOString(),
    fallbackOrder = 0,
    parentFitpicUuid = ""
  } = {}
) {
  const imageData = normalizeStringField(fitpicImage?.imageData) || normalizeStringField(fitpicImage?.images?.preview);
  const importedAt = normalizeTimestampLike(fitpicImage?.importedAt) || fallbackTimestamp;

  return {
    ...fitpicImage,
    fitpicImageUuid:
      typeof fitpicImage?.fitpicImageUuid === "string" && fitpicImage.fitpicImageUuid.trim()
        ? fitpicImage.fitpicImageUuid
        : createUuid(),
    parentFitpicUuid:
      normalizeStringField(fitpicImage?.parentFitpicUuid).trim()
      || normalizeStringField(parentFitpicUuid).trim(),
    order: normalizeOrder(fitpicImage?.order, fallbackOrder),
    imageData,
    images: normalizeImages(fitpicImage?.images, imageData),
    originalPreserved: fitpicImage?.originalPreserved === true,
    archivalOriginalPreserved: fitpicImage?.archivalOriginalPreserved === true,
    ...normalizeImportMetadataFields(fitpicImage, importedAt),
    ...normalizeExtendedImageMetadataFields(fitpicImage),
    imageKind: normalizeOptionalString(fitpicImage?.imageKind)
  };
}

export function createFitpicImageFromLegacyFitpic(
  fitpic,
  {
    createUuid = createFitpicImageUuid,
    fallbackTimestamp = new Date().toISOString(),
    parentFitpicUuid = ""
  } = {}
) {
  const fallbackImportedAt = normalizeTimestampLike(fitpic?.importedAt)
    || normalizeTimestampLike(fitpic?.createdAt)
    || fallbackTimestamp;

  return normalizeFitpicImage(
    {
      imageData: fitpic?.imageData,
      images: fitpic?.images,
      importedAt: fitpic?.importedAt,
      sourceOriginalFilename: fitpic?.sourceOriginalFilename,
      sourceFileSize: fitpic?.sourceFileSize,
      sourceImageWidth: fitpic?.sourceImageWidth,
      sourceImageHeight: fitpic?.sourceImageHeight,
      sourceLastModified: fitpic?.sourceLastModified,
      sourceFileExtension: fitpic?.sourceFileExtension,
      sourceMimeType: fitpic?.sourceMimeType,
      sourceAspectRatio: fitpic?.sourceAspectRatio,
      sourceOrientation: fitpic?.sourceOrientation,
      sourceCapturedAt: fitpic?.sourceCapturedAt,
      sourceOriginalCreatedAt: fitpic?.sourceOriginalCreatedAt,
      sourceCameraMake: fitpic?.sourceCameraMake,
      sourceCameraModel: fitpic?.sourceCameraModel,
      sourceLensModel: fitpic?.sourceLensModel,
      importSource: fitpic?.importSource,
      sourceNamespace: fitpic?.sourceNamespace,
      sourceRelativePath: fitpic?.sourceRelativePath,
      relinkStatus: fitpic?.relinkStatus,
      imageKind: fitpic?.imageKind,
      originalPreserved: fitpic?.originalPreserved,
      archivalOriginalPreserved: fitpic?.archivalOriginalPreserved
    },
    {
      createUuid,
      fallbackTimestamp: fallbackImportedAt,
      fallbackOrder: 0,
      parentFitpicUuid
    }
  );
}

export function getFitpicImages(
  fitpic,
  {
    createFitpicImageUuid: createImageUuid = createFitpicImageUuid,
    fallbackTimestamp = new Date().toISOString(),
    parentFitpicUuid = ""
  } = {}
) {
  const resolvedParentFitpicUuid = normalizeStringField(parentFitpicUuid).trim()
    || normalizeStringField(fitpic?.fitpicUuid).trim();
  const rawImages = Array.isArray(fitpic?.fitpicImages) ? fitpic.fitpicImages : [];
  const normalizedImages = rawImages.length
    ? rawImages
      .map((fitpicImage, index) =>
        normalizeFitpicImage(fitpicImage, {
          createUuid: createImageUuid,
          fallbackTimestamp,
          fallbackOrder: index,
          parentFitpicUuid: resolvedParentFitpicUuid
        })
      )
      .filter((fitpicImage) => fitpicImage.imageData)
      .sort((left, right) => left.order - right.order)
      .map((fitpicImage, index) => (
        fitpicImage.order === index
          ? fitpicImage
          : {
              ...fitpicImage,
              order: index
            }
      ))
    : [];

  if (normalizedImages.length) {
    return normalizedImages;
  }

  const legacyImage = createFitpicImageFromLegacyFitpic(fitpic, {
    createUuid: createImageUuid,
    fallbackTimestamp,
    parentFitpicUuid: resolvedParentFitpicUuid
  });

  return legacyImage.imageData ? [legacyImage] : [];
}

export function getPrimaryFitpicImage(
  fitpic,
  {
    createFitpicImageUuid: createImageUuid = createFitpicImageUuid,
    fallbackTimestamp = new Date().toISOString(),
    parentFitpicUuid = ""
  } = {}
) {
  const fitpicImages = getFitpicImages(fitpic, {
    createFitpicImageUuid: createImageUuid,
    fallbackTimestamp,
    parentFitpicUuid
  });

  if (!fitpicImages.length) {
    return null;
  }

  const requestedPrimaryImageUuid = normalizeStringField(fitpic?.primaryImageUuid).trim();
  return fitpicImages.find((fitpicImage) => fitpicImage.fitpicImageUuid === requestedPrimaryImageUuid)
    ?? fitpicImages[0]
    ?? null;
}

export function getFitpicImageEntities(
  fitpic,
  {
    createFitpicImageUuid: createImageUuid = createFitpicImageUuid,
    fallbackTimestamp = new Date().toISOString(),
    parentFitpicUuid = ""
  } = {}
) {
  const fitpicImages = getFitpicImages(fitpic, {
    createFitpicImageUuid: createImageUuid,
    fallbackTimestamp,
    parentFitpicUuid
  });
  const fitpicUuid = normalizeStringField(fitpic?.fitpicUuid).trim()
    || normalizeStringField(parentFitpicUuid).trim();

  return fitpicImages.map((fitpicImage) => ({
    entityType: "fitpicImage",
    fitpicUuid,
    fitpicImageUuid: fitpicImage.fitpicImageUuid,
    parentFitpicUuid: fitpicImage.parentFitpicUuid || fitpicUuid,
    order: fitpicImage.order,
    name: normalizeStringField(fitpic?.name),
    fitDate: normalizeOptionalTimestamp(fitpic?.fitDate),
    tags: normalizeTagList(fitpic?.tags),
    favorite: normalizeBoolean(fitpic?.favorite),
    imageData: fitpicImage.imageData,
    images: fitpicImage.images,
    importedAt: fitpicImage.importedAt,
    sourceOriginalFilename: fitpicImage.sourceOriginalFilename,
    sourceFileSize: fitpicImage.sourceFileSize,
    sourceImageWidth: fitpicImage.sourceImageWidth,
    sourceImageHeight: fitpicImage.sourceImageHeight,
    sourceLastModified: fitpicImage.sourceLastModified,
    sourceFileExtension: fitpicImage.sourceFileExtension,
    sourceMimeType: fitpicImage.sourceMimeType,
    sourceAspectRatio: fitpicImage.sourceAspectRatio,
    sourceOrientation: fitpicImage.sourceOrientation,
    sourceCapturedAt: fitpicImage.sourceCapturedAt,
    sourceOriginalCreatedAt: fitpicImage.sourceOriginalCreatedAt,
    sourceCameraMake: fitpicImage.sourceCameraMake,
    sourceCameraModel: fitpicImage.sourceCameraModel,
    sourceLensModel: fitpicImage.sourceLensModel,
    importSource: fitpicImage.importSource,
    sourceNamespace: fitpicImage.sourceNamespace,
    sourceRelativePath: fitpicImage.sourceRelativePath,
    relinkStatus: fitpicImage.relinkStatus,
    imageKind: fitpicImage.imageKind,
    originalPreserved: fitpicImage.originalPreserved === true,
    archivalOriginalPreserved: fitpicImage.archivalOriginalPreserved === true
  }));
}

export function normalizeFitpic(
  fitpic,
  {
    createId = () => `fitpic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createUuid = createFitpicUuid,
    createFitpicImageUuid: createImageUuid = createFitpicImageUuid,
    fallbackTimestamp = new Date().toISOString()
  } = {}
) {
  const createdAt = normalizeTimestampLike(fitpic?.createdAt) || fallbackTimestamp;
  const updatedAt = normalizeTimestampLike(fitpic?.updatedAt) || createdAt;
  const fitpicUuid =
    typeof fitpic?.fitpicUuid === "string" && fitpic.fitpicUuid.trim() ? fitpic.fitpicUuid : createUuid();
  const importedAt = normalizeTimestampLike(fitpic?.importedAt) || createdAt;
  const fitDate = normalizeOptionalTimestamp(fitpic?.fitDate)
    ?? normalizeOptionalTimestamp(fitpic?.sourceCapturedAt)
    ?? normalizeOptionalTimestamp(fitpic?.sourceOriginalCreatedAt)
    ?? normalizeOptionalTimestamp(fitpic?.importedAt)
    ?? normalizeOptionalTimestamp(fitpic?.createdAt)
    ?? null;
  const name = normalizeStringField(fitpic?.name).trim()
    || normalizeStringField(fitpic?.title).trim()
    || getFitpicNameFromFilename(fitpic?.sourceOriginalFilename);
  const fitpicImages = getFitpicImages(
    {
      ...fitpic,
      fitpicUuid
    },
    {
      createFitpicImageUuid: createImageUuid,
      fallbackTimestamp: importedAt,
      parentFitpicUuid: fitpicUuid
    }
  );
  const primaryFitpicImage = getPrimaryFitpicImage(
    {
      ...fitpic,
      fitpicUuid,
      fitpicImages
    },
    {
      createFitpicImageUuid: createImageUuid,
      fallbackTimestamp: importedAt,
      parentFitpicUuid: fitpicUuid
    }
  );
  const primaryImageUuid = primaryFitpicImage?.fitpicImageUuid ?? null;
  const primaryImageData = primaryFitpicImage?.imageData ?? "";
  const primaryImages = normalizeImages(primaryFitpicImage?.images, primaryImageData);
  const primaryImportMetadata = primaryFitpicImage
    ? normalizeImportMetadataFields(primaryFitpicImage, importedAt)
    : normalizeImportMetadataFields(fitpic, importedAt);
  const primaryExtendedMetadata = primaryFitpicImage
    ? normalizeExtendedImageMetadataFields(primaryFitpicImage)
    : normalizeExtendedImageMetadataFields(fitpic);

  return {
    ...fitpic,
    id: typeof fitpic?.id === "string" && fitpic.id.trim() ? fitpic.id : createId(),
    fitpicUuid,
    name,
    description: normalizeStringField(fitpic?.description),
    tags: normalizeTagList(fitpic?.tags),
    favorite: normalizeBoolean(fitpic?.favorite),
    createdAt,
    updatedAt,
    fitDate,
    primaryImageUuid,
    imageData: primaryImageData,
    images: primaryImages,
    fitpicImages,
    originalPreserved: primaryFitpicImage?.originalPreserved === true || fitpic?.originalPreserved === true,
    archivalOriginalPreserved:
      primaryFitpicImage?.archivalOriginalPreserved === true
      || fitpic?.archivalOriginalPreserved === true,
    linkedItemUuids: normalizeStringList(fitpic?.linkedItemUuids),
    linkedItemIds: normalizeStringList(fitpic?.linkedItemIds),
    savedOutfitUuid: normalizeNullableString(fitpic?.savedOutfitUuid),
    savedOutfitId: normalizeNullableString(fitpic?.savedOutfitId),
    ...primaryImportMetadata,
    ...primaryExtendedMetadata
  };
}

export function normalizeFitpics(
  fitpics,
  options = {}
) {
  if (!Array.isArray(fitpics)) {
    return [];
  }

  const fallbackBase = normalizeTimestampLike(options.fallbackTimestamp) || new Date().toISOString();
  const fallbackBaseMs = Date.parse(fallbackBase);

  return fitpics
    .map((fitpic, index) =>
      normalizeFitpic(fitpic, {
        ...options,
        fallbackTimestamp: new Date(fallbackBaseMs + index).toISOString()
      })
    )
    .filter((fitpic) => Array.isArray(fitpic.fitpicImages) && fitpic.fitpicImages.length > 0);
}

async function createImportedFitpicImageFromFile(
  file,
  {
    createFitpicImageUuid: createImageUuid,
    readFileAsDataUrl,
    loadImage,
    buildImportedImageAssetSet,
    compressImageSource,
    now = () => new Date().toISOString(),
    importedAt = now(),
    parentFitpicUuid = "",
    order = 0
  }
) {
  const importMetadata = await readImageFileMetadata(file, {
    now: () => importedAt,
    readFileAsDataUrl,
    loadImage
  });
  const rawImageAssets = typeof buildImportedImageAssetSet === "function"
    ? await buildImportedImageAssetSet(file, {
        readFileAsDataUrl,
        loadImage
      })
    : (() => {
        if (typeof compressImageSource !== "function") {
          throw new Error("Image import pipeline is unavailable.");
        }

        return compressImageSource(file);
      })();
  const imageAssets = normalizeImportedImageAssets(rawImageAssets);
  const imageData = imageAssets.display.src;

  return normalizeFitpicImage(
    {
      fitpicImageUuid: createImageUuid?.(),
      parentFitpicUuid,
      order,
      imageData,
      images: {
        original: imageAssets.original.src,
        display: imageAssets.display.src,
        thumbnail: imageAssets.thumbnail.src
      },
      originalPreserved: imageAssets.originalPreserved,
      archivalOriginalPreserved: imageAssets.archivalOriginalPreserved,
      ...importMetadata
    },
    {
      createUuid: createImageUuid,
      fallbackTimestamp: importedAt,
      fallbackOrder: order,
      parentFitpicUuid
    }
  );
}

export async function createImportedFitpicFromFile(
  file,
  {
    createId,
    createUuid,
    createFitpicImageUuid: createImageUuid,
    readFileAsDataUrl,
    loadImage,
    buildImportedImageAssetSet,
    compressImageSource,
    now = () => new Date().toISOString()
  }
) {
  const fitpicUuid = createUuid?.();
  const importedAt = now();
  const fitpicImage = await createImportedFitpicImageFromFile(file, {
    createFitpicImageUuid: createImageUuid,
    readFileAsDataUrl,
    loadImage,
    buildImportedImageAssetSet,
    compressImageSource,
    now,
    importedAt,
    parentFitpicUuid: fitpicUuid,
    order: 0
  });

  return normalizeFitpic(
    {
      id: createId?.(),
      fitpicUuid,
      name: getFitpicNameFromFilename(file?.name),
      description: "",
      tags: [],
      favorite: false,
      createdAt: importedAt,
      updatedAt: importedAt,
      primaryImageUuid: fitpicImage.fitpicImageUuid,
      fitpicImages: [fitpicImage],
      imageData: fitpicImage.imageData,
      images: fitpicImage.images,
      originalPreserved: fitpicImage.originalPreserved,
      archivalOriginalPreserved: fitpicImage.archivalOriginalPreserved,
      ...normalizeImportMetadataFields(fitpicImage, importedAt),
      ...normalizeExtendedImageMetadataFields(fitpicImage)
    },
    {
      createId,
      createUuid,
      createFitpicImageUuid: createImageUuid,
      fallbackTimestamp: importedAt
    }
  );
}

export async function createImportedGroupedFitpicFromFiles(
  files,
  {
    createId,
    createUuid,
    createFitpicImageUuid: createImageUuid,
    readFileAsDataUrl,
    loadImage,
    buildImportedImageAssetSet,
    compressImageSource,
    now = () => new Date().toISOString()
  }
) {
  const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [];

  if (!normalizedFiles.length) {
    throw new Error("No image files were provided.");
  }

  const fitpicUuid = createUuid?.();
  const importedAt = now();
  const fitpicImages = await Promise.all(
    normalizedFiles.map((file, index) =>
      createImportedFitpicImageFromFile(file, {
        createFitpicImageUuid: createImageUuid,
        readFileAsDataUrl,
        loadImage,
        buildImportedImageAssetSet,
        compressImageSource,
        now,
        importedAt,
        parentFitpicUuid: fitpicUuid,
        order: index
      })
    )
  );

  const primaryFitpicImage = fitpicImages[0] ?? null;

  return normalizeFitpic(
    {
      id: createId?.(),
      fitpicUuid,
      name: getFitpicNameFromFilename(normalizedFiles[0]?.name),
      description: "",
      tags: [],
      favorite: false,
      createdAt: importedAt,
      updatedAt: importedAt,
      primaryImageUuid: primaryFitpicImage?.fitpicImageUuid ?? null,
      fitpicImages,
      imageData: primaryFitpicImage?.imageData ?? "",
      images: primaryFitpicImage?.images ?? { original: "", display: "", preview: "", thumbnail: "" },
      originalPreserved: primaryFitpicImage?.originalPreserved === true,
      archivalOriginalPreserved: primaryFitpicImage?.archivalOriginalPreserved === true,
      ...normalizeImportMetadataFields(primaryFitpicImage, importedAt),
      ...normalizeExtendedImageMetadataFields(primaryFitpicImage)
    },
    {
      createId,
      createUuid,
      createFitpicImageUuid: createImageUuid,
      fallbackTimestamp: importedAt
    }
  );
}

export async function replaceFitpicImageFromFile(
  fitpic,
  file,
  {
    createFitpicImageUuid: createImageUuid,
    readFileAsDataUrl,
    loadImage,
    buildImportedImageAssetSet,
    compressImageSource,
    now = () => new Date().toISOString()
  }
) {
  const updatedAt = now();
  const currentFitpic = normalizeFitpic(fitpic, {
    createFitpicImageUuid: createImageUuid,
    fallbackTimestamp: normalizeTimestampLike(fitpic?.createdAt) || updatedAt
  });
  const importMetadata = await readImageFileMetadata(file, {
    now: () => updatedAt,
    readFileAsDataUrl,
    loadImage
  });
  const rawImageAssets = typeof buildImportedImageAssetSet === "function"
    ? await buildImportedImageAssetSet(file, {
        readFileAsDataUrl,
        loadImage
      })
    : (() => {
        if (typeof compressImageSource !== "function") {
          throw new Error("Image import pipeline is unavailable.");
        }

        return compressImageSource(file);
      })();
  const imageAssets = normalizeImportedImageAssets(rawImageAssets);
  const imageData = imageAssets.display.src;
  const replacementPrimaryImage = normalizeFitpicImage(
    {
      ...getPrimaryFitpicImage(currentFitpic, {
        createFitpicImageUuid: createImageUuid,
        fallbackTimestamp: updatedAt,
        parentFitpicUuid: currentFitpic.fitpicUuid
      }),
      imageData,
      images: {
        ...(currentFitpic.images ?? {}),
        original: imageAssets.original.src,
        display: imageAssets.display.src,
        thumbnail: imageAssets.thumbnail.src
      },
      originalPreserved: imageAssets.originalPreserved,
      archivalOriginalPreserved: imageAssets.archivalOriginalPreserved,
      ...importMetadata
    },
    {
      createUuid: createImageUuid,
      fallbackTimestamp: updatedAt,
      fallbackOrder: 0,
      parentFitpicUuid: currentFitpic.fitpicUuid
    }
  );
  const nextFitpicImages = currentFitpic.fitpicImages.map((fitpicImage) =>
    fitpicImage.fitpicImageUuid === replacementPrimaryImage.fitpicImageUuid
      ? replacementPrimaryImage
      : fitpicImage
  );

  return normalizeFitpic(
    {
      ...fitpic,
      fitDate: currentFitpic.fitDate,
      fitpicUuid: currentFitpic.fitpicUuid,
      fitpicImages: nextFitpicImages,
      primaryImageUuid: replacementPrimaryImage.fitpicImageUuid,
      imageData: replacementPrimaryImage.imageData,
      images: replacementPrimaryImage.images,
      ...importMetadata,
      updatedAt
    },
    {
      createFitpicImageUuid: createImageUuid,
      fallbackTimestamp: normalizeTimestampLike(fitpic?.createdAt) || updatedAt
    }
  );
}
