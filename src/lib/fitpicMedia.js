import {
  getCachedMediaObjectUrl,
  getMediaRecord,
  replaceMediaRecordForOwnerVariant
} from "./storage.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0;
}

function normalizeVariantKey(value) {
  return value === "original" || value === "display" || value === "preview" || value === "thumbnail"
    ? value
    : "display";
}

function getVariantSrc(value) {
  if (typeof value === "string") {
    return normalizeString(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeString(value.src);
  }

  return "";
}

function cloneVariant(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

async function sourceToBlob(source) {
  if (source instanceof Blob) {
    return source;
  }

  const normalizedSource = normalizeString(source);

  if (!normalizedSource) {
    return null;
  }

  const response = await fetch(normalizedSource);

  if (!response.ok) {
    throw new Error("Fitpic media could not be loaded.");
  }

  return response.blob();
}

export function isFitpicMediaRefVariant(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && normalizeString(value.mediaId)
  );
}

export function createFitpicMediaRef({
  mediaId = "",
  mimeType = "",
  fileSize = 0,
  width = 0,
  height = 0,
  src = ""
} = {}) {
  return {
    ...(src ? { src } : {}),
    mediaId: normalizeString(mediaId),
    mimeType: normalizeString(mimeType),
    fileSize: normalizeNumber(fileSize),
    width: normalizeNumber(width),
    height: normalizeNumber(height)
  };
}

export async function saveFitpicMediaVariant(
  {
    fitpicImageUuid = "",
    variant = "display",
    source,
    mimeType = "",
    fileSize = 0,
    width = 0,
    height = 0,
    createdAt = "",
    updatedAt = "",
    sourceKind = "fitpicImport"
  } = {}
) {
  const ownerId = normalizeString(fitpicImageUuid);

  if (!ownerId) {
    throw new Error("A fitpic image UUID is required.");
  }

  const blob = await sourceToBlob(source);

  if (!blob || blob.size <= 0) {
    return createFitpicMediaRef();
  }

  const mediaRecord = await replaceMediaRecordForOwnerVariant({
    ownerType: "fitpicImage",
    ownerId,
    variant: normalizeVariantKey(variant),
    blob,
    mimeType: normalizeString(mimeType) || blob.type || "",
    fileSize: normalizeNumber(fileSize) || blob.size,
    width,
    height,
    createdAt,
    updatedAt,
    sourceKind
  });

  return createFitpicMediaRef(mediaRecord);
}

export async function saveFitpicMediaSet(
  fitpicImage,
  {
    original,
    display,
    preview,
    thumbnail
  } = {},
  {
    sourceKind = "fitpicImport"
  } = {}
) {
  const fitpicImageUuid = normalizeString(fitpicImage?.fitpicImageUuid);
  const createdAt = normalizeString(fitpicImage?.importedAt) || normalizeString(fitpicImage?.createdAt);
  const updatedAt = normalizeString(fitpicImage?.updatedAt) || createdAt;
  const displaySource = getVariantSrc(display);
  const previewSource = getVariantSrc(preview) || displaySource;
  const previewMatchesDisplay = previewSource && previewSource === displaySource;

  const originalRef = getVariantSrc(original)
    ? await saveFitpicMediaVariant({
        fitpicImageUuid,
        variant: "original",
        source: getVariantSrc(original),
        mimeType: cloneVariant(original).mimeType,
        fileSize: cloneVariant(original).fileSize,
        width: cloneVariant(original).width,
        height: cloneVariant(original).height,
        createdAt,
        updatedAt,
        sourceKind
      })
    : createFitpicMediaRef();
  const displayRef = displaySource
    ? await saveFitpicMediaVariant({
        fitpicImageUuid,
        variant: "display",
        source: displaySource,
        mimeType: cloneVariant(display).mimeType,
        fileSize: cloneVariant(display).fileSize,
        width: cloneVariant(display).width,
        height: cloneVariant(display).height,
        createdAt,
        updatedAt,
        sourceKind
      })
    : createFitpicMediaRef();
  const previewRef = previewMatchesDisplay
    ? createFitpicMediaRef(displayRef)
    : previewSource
      ? await saveFitpicMediaVariant({
          fitpicImageUuid,
          variant: "preview",
          source: previewSource,
          mimeType: cloneVariant(preview).mimeType,
          fileSize: cloneVariant(preview).fileSize,
          width: cloneVariant(preview).width,
          height: cloneVariant(preview).height,
          createdAt,
          updatedAt,
          sourceKind
        })
      : createFitpicMediaRef(displayRef);
  const thumbnailRef = getVariantSrc(thumbnail)
    ? await saveFitpicMediaVariant({
        fitpicImageUuid,
        variant: "thumbnail",
        source: getVariantSrc(thumbnail),
        mimeType: cloneVariant(thumbnail).mimeType,
        fileSize: cloneVariant(thumbnail).fileSize,
        width: cloneVariant(thumbnail).width,
        height: cloneVariant(thumbnail).height,
        createdAt,
        updatedAt,
        sourceKind
      })
    : createFitpicMediaRef();

  return {
    original: originalRef,
    display: displayRef,
    preview: previewRef,
    thumbnail: thumbnailRef
  };
}

function getLegacyVariantFallbackSource(fitpicImage = {}, variant = "display") {
  if (variant === "original") {
    return getVariantSrc(fitpicImage?.images?.original);
  }

  if (variant === "thumbnail") {
    return (
      getVariantSrc(fitpicImage?.images?.thumbnail)
      || getVariantSrc(fitpicImage?.images?.preview)
      || getVariantSrc(fitpicImage?.images?.display)
      || normalizeString(fitpicImage?.imageData)
    );
  }

  if (variant === "preview") {
    return (
      getVariantSrc(fitpicImage?.images?.preview)
      || getVariantSrc(fitpicImage?.images?.display)
      || normalizeString(fitpicImage?.imageData)
    );
  }

  return (
    getVariantSrc(fitpicImage?.images?.display)
    || getVariantSrc(fitpicImage?.images?.preview)
    || normalizeString(fitpicImage?.imageData)
  );
}

export async function resolveFitpicImageVariantSrc(fitpicImage = {}, variant = "display") {
  const normalizedVariant = normalizeVariantKey(variant);
  const candidate = fitpicImage?.images?.[normalizedVariant];

  if (isFitpicMediaRefVariant(candidate)) {
    const cachedUrl = await getCachedMediaObjectUrl(candidate.mediaId);

    if (cachedUrl) {
      return cachedUrl;
    }
  }

  return getLegacyVariantFallbackSource(fitpicImage, normalizedVariant);
}

export async function resolveFitpicPrimaryImageSrc(fitpic = {}, fitpicImage = null) {
  const primaryImage = fitpicImage ?? null;

  if (primaryImage) {
    const displaySrc = await resolveFitpicImageVariantSrc(primaryImage, "display");

    if (displaySrc) {
      return displaySrc;
    }

    const previewSrc = await resolveFitpicImageVariantSrc(primaryImage, "preview");

    if (previewSrc) {
      return previewSrc;
    }
  }

  return normalizeString(fitpic?.imageData);
}

export async function materializeFitpicImageForExport(fitpicImage = {}, variant = "display") {
  const normalizedVariant = normalizeVariantKey(variant);
  const candidate = fitpicImage?.images?.[normalizedVariant];

  if (isFitpicMediaRefVariant(candidate)) {
    const cachedUrl = await getCachedMediaObjectUrl(candidate.mediaId);

    if (cachedUrl) {
      return cachedUrl;
    }

    const mediaRecord = await getMediaRecord(candidate.mediaId);

    if (mediaRecord?.blob && mediaRecord.blob.size > 0) {
      return getCachedMediaObjectUrl(mediaRecord.mediaId);
    }
  }

  return getLegacyVariantFallbackSource(fitpicImage, normalizedVariant);
}

export async function materializeFitpicForRuntime(fitpic = {}) {
  const nextFitpicImages = await Promise.all(
    (Array.isArray(fitpic?.fitpicImages) ? fitpic.fitpicImages : []).map(async (fitpicImage) => ({
      ...fitpicImage,
      imageData: await resolveFitpicImageVariantSrc(fitpicImage, "display")
    }))
  );
  const primaryFitpicImage = nextFitpicImages.find(
    (fitpicImage) => normalizeString(fitpicImage?.fitpicImageUuid) === normalizeString(fitpic?.primaryImageUuid)
  ) ?? nextFitpicImages[0] ?? null;

  return {
    ...fitpic,
    fitpicImages: nextFitpicImages,
    imageData: await resolveFitpicPrimaryImageSrc(fitpic, primaryFitpicImage)
  };
}

export async function materializeFitpicsForRuntime(fitpics = []) {
  const normalizedFitpics = Array.isArray(fitpics) ? fitpics : [];
  const materialized = [];

  for (const fitpic of normalizedFitpics) {
    materialized.push(await materializeFitpicForRuntime(fitpic));
  }

  return materialized;
}

export function stripFitpicRuntimeMediaAliasesForPersistence(fitpic = {}) {
  const fitpicUsesRefs = ["original", "display", "preview", "thumbnail"].some((variant) =>
    isFitpicMediaRefVariant(fitpic?.images?.[variant])
  );

  return {
    ...fitpic,
    imageData: fitpicUsesRefs ? "" : normalizeString(fitpic?.imageData),
    fitpicImages: (Array.isArray(fitpic?.fitpicImages) ? fitpic.fitpicImages : []).map((fitpicImage) => {
      const fitpicImageUsesRefs = ["original", "display", "preview", "thumbnail"].some((variant) =>
        isFitpicMediaRefVariant(fitpicImage?.images?.[variant])
      );

      return {
        ...fitpicImage,
        imageData: fitpicImageUsesRefs ? "" : normalizeString(fitpicImage?.imageData)
      };
    })
  };
}

function stripFitpicImageRuntimeMediaAliasesForPersistence(fitpicImage = {}) {
  const fitpicImageUsesRefs = ["original", "display", "preview", "thumbnail"].some((variant) =>
    isFitpicMediaRefVariant(fitpicImage?.images?.[variant])
  );

  return {
    ...fitpicImage,
    imageData: fitpicImageUsesRefs ? "" : normalizeString(fitpicImage?.imageData)
  };
}

export function stripFitpicsRuntimeMediaAliasesForPersistence(fitpics = []) {
  return (Array.isArray(fitpics) ? fitpics : []).map((fitpic) =>
    stripFitpicRuntimeMediaAliasesForPersistence(fitpic)
  );
}

export function fitpicHasMediaRefs(fitpic = {}) {
  const fitpicImages = Array.isArray(fitpic?.fitpicImages) ? fitpic.fitpicImages : [];

  return fitpicImages.some((fitpicImage) =>
    ["original", "display", "preview", "thumbnail"].some((variant) =>
      isFitpicMediaRefVariant(fitpicImage?.images?.[variant])
    )
  );
}

export async function migrateFitpicToMediaStore(
  fitpic = {},
  {
    sourceKind = "fitpicMigration"
  } = {}
) {
  const fitpicImages = Array.isArray(fitpic?.fitpicImages) ? fitpic.fitpicImages : [];

  if (!fitpicImages.length) {
    return fitpic;
  }

  let didChange = false;
  const migratedFitpicImages = [];

  for (const fitpicImage of fitpicImages) {
    if (
      ["original", "display", "preview", "thumbnail"].every((variant) =>
        !getLegacyVariantFallbackSource(fitpicImage, variant)
        || isFitpicMediaRefVariant(fitpicImage?.images?.[variant])
      )
    ) {
      migratedFitpicImages.push(stripFitpicImageRuntimeMediaAliasesForPersistence(fitpicImage));
      continue;
    }

    didChange = true;
    const mediaRefs = await saveFitpicMediaSet(
      fitpicImage,
      {
        original: cloneVariant(fitpicImage?.images?.original),
        display: getLegacyVariantFallbackSource(fitpicImage, "display")
          ? {
              ...cloneVariant(fitpicImage?.images?.display),
              src: getLegacyVariantFallbackSource(fitpicImage, "display")
            }
          : null,
        preview: getLegacyVariantFallbackSource(fitpicImage, "preview")
          ? {
              ...cloneVariant(fitpicImage?.images?.preview),
              src: getLegacyVariantFallbackSource(fitpicImage, "preview")
            }
          : null,
        thumbnail: getLegacyVariantFallbackSource(fitpicImage, "thumbnail")
          ? {
              ...cloneVariant(fitpicImage?.images?.thumbnail),
              src: getLegacyVariantFallbackSource(fitpicImage, "thumbnail")
            }
          : null
      },
      {
        sourceKind
      }
    );

    migratedFitpicImages.push({
      ...fitpicImage,
      imageData: "",
      images: mediaRefs
    });
  }

  if (!didChange) {
    return materializeFitpicForRuntime(fitpic);
  }

  return materializeFitpicForRuntime({
    ...fitpic,
    imageData: "",
    fitpicImages: migratedFitpicImages
  });
}

export async function migrateFitpicsToMediaStore(fitpics = [], options = {}) {
  const normalizedFitpics = Array.isArray(fitpics) ? fitpics : [];
  const migratedFitpics = [];

  for (const fitpic of normalizedFitpics) {
    migratedFitpics.push(await migrateFitpicToMediaStore(fitpic, options));
  }

  return migratedFitpics;
}
