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

  return {
    ...currentImages,
    preview: normalizeStringField(imageData) || normalizeStringField(currentImages.preview),
    original: normalizeStringField(currentImages.original),
    thumbnail: normalizeStringField(currentImages.thumbnail)
  };
}

export function createFitpicUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `fitpic_uuid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getFitpicNameFromFilename(filename) {
  const normalizedFilename = normalizeStringField(filename).trim();

  if (!normalizedFilename) {
    return "Untitled fitpic";
  }

  return normalizedFilename.replace(/\.[^.]+$/, "") || normalizedFilename;
}

export function normalizeFitpic(
  fitpic,
  {
    createId = () => `fitpic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createUuid = createFitpicUuid,
    fallbackTimestamp = new Date().toISOString()
  } = {}
) {
  const createdAt = normalizeTimestampLike(fitpic?.createdAt) || fallbackTimestamp;
  const updatedAt = normalizeTimestampLike(fitpic?.updatedAt) || createdAt;
  const imageData = normalizeStringField(fitpic?.imageData) || normalizeStringField(fitpic?.images?.preview);
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

  return {
    ...fitpic,
    id: typeof fitpic?.id === "string" && fitpic.id.trim() ? fitpic.id : createId(),
    fitpicUuid: typeof fitpic?.fitpicUuid === "string" && fitpic.fitpicUuid.trim() ? fitpic.fitpicUuid : createUuid(),
    name,
    description: normalizeStringField(fitpic?.description),
    tags: normalizeTagList(fitpic?.tags),
    favorite: normalizeBoolean(fitpic?.favorite),
    createdAt,
    updatedAt,
    fitDate,
    imageData,
    images: normalizeImages(fitpic?.images, imageData),
    linkedItemUuids: normalizeStringList(fitpic?.linkedItemUuids),
    linkedItemIds: normalizeStringList(fitpic?.linkedItemIds),
    savedOutfitUuid: normalizeNullableString(fitpic?.savedOutfitUuid),
    savedOutfitId: normalizeNullableString(fitpic?.savedOutfitId),
    ...normalizeImportMetadataFields(fitpic, importedAt),
    ...normalizeExtendedImageMetadataFields(fitpic)
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
    .filter((fitpic) => fitpic.imageData);
}

export async function createImportedFitpicFromFile(
  file,
  {
    createId,
    createUuid,
    readFileAsDataUrl,
    loadImage,
    compressImageSource,
    now = () => new Date().toISOString()
  }
) {
  const importedAt = now();
  const importMetadata = await readImageFileMetadata(file, {
    now: () => importedAt,
    readFileAsDataUrl,
    loadImage
  });
  const imageData = await compressImageSource(file);

  return normalizeFitpic(
    {
      id: createId?.(),
      fitpicUuid: createUuid?.(),
      name: getFitpicNameFromFilename(file?.name),
      description: "",
      tags: [],
      favorite: false,
      imageData,
      images: {
        preview: imageData
      },
      createdAt: importedAt,
      updatedAt: importedAt,
      ...importMetadata
    },
    {
      createId,
      createUuid,
      fallbackTimestamp: importedAt
    }
  );
}

export async function replaceFitpicImageFromFile(
  fitpic,
  file,
  {
    readFileAsDataUrl,
    loadImage,
    compressImageSource,
    now = () => new Date().toISOString()
  }
) {
  const updatedAt = now();
  const currentFitpic = normalizeFitpic(fitpic, {
    fallbackTimestamp: normalizeTimestampLike(fitpic?.createdAt) || updatedAt
  });
  const importMetadata = await readImageFileMetadata(file, {
    now: () => updatedAt,
    readFileAsDataUrl,
    loadImage
  });
  const imageData = await compressImageSource(file);

  return normalizeFitpic(
    {
      ...fitpic,
      fitDate: currentFitpic.fitDate,
      ...importMetadata,
      imageData,
      images: {
        ...(fitpic?.images ?? {}),
        preview: imageData
      },
      updatedAt
    },
    {
      fallbackTimestamp: normalizeTimestampLike(fitpic?.createdAt) || updatedAt
    }
  );
}
