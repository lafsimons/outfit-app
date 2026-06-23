import {
  getActiveWardrobeItemImage,
  getWardrobeItemImages,
  mirrorActiveWardrobeImageAssetToLegacyAliases
} from "./itemModel.js";
import {
  createFitpicImageUuid,
  getPrimaryFitpicImage,
  getFitpicImages,
  normalizeFitpic
} from "./fitpics.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getWardrobeAssetThumbnailSource(asset) {
  return (
    normalizeString(asset?.images?.display?.src)
    || normalizeString(asset?.images?.preview?.src)
    || normalizeString(asset?.imageUrl)
    || normalizeString(asset?.images?.original?.src)
  );
}

function getFitpicImageThumbnailSource(fitpicImage) {
  return (
    normalizeString(fitpicImage?.images?.display)
    || normalizeString(fitpicImage?.images?.preview)
    || normalizeString(fitpicImage?.imageData)
    || normalizeString(fitpicImage?.images?.original)
  );
}

function mergeThumbnailVariant(existingThumbnail, nextThumbnail) {
  return {
    ...(existingThumbnail && typeof existingThumbnail === "object" ? existingThumbnail : {}),
    ...nextThumbnail
  };
}

function thumbnailChanged(existingThumbnail, nextThumbnail) {
  return (
    normalizeString(existingThumbnail?.src) !== normalizeString(nextThumbnail?.src)
    || Number(existingThumbnail?.fileSize) !== Number(nextThumbnail?.fileSize)
    || Number(existingThumbnail?.width) !== Number(nextThumbnail?.width)
    || Number(existingThumbnail?.height) !== Number(nextThumbnail?.height)
    || normalizeString(existingThumbnail?.mimeType) !== normalizeString(nextThumbnail?.mimeType)
  );
}

async function migrateWardrobeAssetThumbnail(asset, { buildThumbnailVariantFromSource } = {}) {
  const source = getWardrobeAssetThumbnailSource(asset);

  if (!source || typeof buildThumbnailVariantFromSource !== "function") {
    return { asset, changed: false };
  }

  const nextThumbnail = await buildThumbnailVariantFromSource(source);
  const currentThumbnail = asset?.images?.thumbnail;
  const changed = thumbnailChanged(currentThumbnail, nextThumbnail);

  if (!changed) {
    return { asset, changed: false };
  }

  return {
    changed: true,
    asset: {
      ...asset,
      images: {
        ...(asset?.images ?? {}),
        thumbnail: mergeThumbnailVariant(currentThumbnail, nextThumbnail)
      }
    }
  };
}

export async function migrateWardrobeItemThumbnailDerivatives(
  item,
  { buildThumbnailVariantFromSource } = {}
) {
  const itemImages = getWardrobeItemImages(item);
  let changed = false;
  const nextItemImages = [];

  for (const itemImage of itemImages) {
    const nextCanonicalResult = await migrateWardrobeAssetThumbnail(itemImage.canonicalAsset, {
      buildThumbnailVariantFromSource
    });
    changed = changed || nextCanonicalResult.changed;
    const nextDerivedAssets = [];

    for (const asset of itemImage.derivedAssets ?? []) {
      const nextDerivedResult = await migrateWardrobeAssetThumbnail(asset, {
        buildThumbnailVariantFromSource
      });
      changed = changed || nextDerivedResult.changed;
      nextDerivedAssets.push(nextDerivedResult.asset);
    }

    nextItemImages.push({
      ...itemImage,
      canonicalAsset: nextCanonicalResult.asset,
      derivedAssets: nextDerivedAssets
    });
  }

  if (!changed) {
    return item;
  }

  return mirrorActiveWardrobeImageAssetToLegacyAliases({
    ...item,
    itemImages: nextItemImages
  });
}

export async function migrateFitpicThumbnailDerivatives(
  fitpic,
  { buildThumbnailVariantFromSource } = {}
) {
  const fitpicImages = getFitpicImages(fitpic, {
    createFitpicImageUuid,
    fallbackTimestamp: fitpic?.createdAt
  });
  let changed = false;
  const nextFitpicImages = [];

  for (const fitpicImage of fitpicImages) {
    const source = getFitpicImageThumbnailSource(fitpicImage);

    if (!source || typeof buildThumbnailVariantFromSource !== "function") {
      nextFitpicImages.push(fitpicImage);
      continue;
    }

    const nextThumbnail = await buildThumbnailVariantFromSource(source);
    const currentThumbnail = fitpicImage?.images?.thumbnail;
    const nextFitpicImage = thumbnailChanged(currentThumbnail, nextThumbnail)
      ? {
          ...fitpicImage,
          images: {
            ...(fitpicImage?.images ?? {}),
            thumbnail: mergeThumbnailVariant(currentThumbnail, nextThumbnail).src
          }
        }
      : fitpicImage;

    changed = changed || nextFitpicImage !== fitpicImage;
    nextFitpicImages.push(nextFitpicImage);
  }

  if (!changed) {
    return fitpic;
  }

  const draftWithImages = {
    ...fitpic,
    fitpicImages: nextFitpicImages
  };
  const primaryFitpicImage = getPrimaryFitpicImage(draftWithImages, {
    createFitpicImageUuid,
    fallbackTimestamp: fitpic?.createdAt
  }) ?? nextFitpicImages[0] ?? null;

  return normalizeFitpic(
    {
      ...draftWithImages,
      primaryImageUuid: primaryFitpicImage?.fitpicImageUuid ?? fitpic?.primaryImageUuid ?? null,
      imageData: primaryFitpicImage?.imageData ?? fitpic?.imageData ?? "",
      images: primaryFitpicImage?.images ?? fitpic?.images ?? {},
      originalPreserved: primaryFitpicImage?.originalPreserved === true,
      archivalOriginalPreserved: primaryFitpicImage?.archivalOriginalPreserved === true
    },
    {
      createFitpicImageUuid,
      fallbackTimestamp: fitpic?.createdAt
    }
  );
}
