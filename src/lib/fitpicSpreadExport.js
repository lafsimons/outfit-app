import { getFitpicImages, getPrimaryFitpicImage } from "./fitpics.js";

export const FITPIC_SPREAD_CARD_WIDTH = 308;
export const FITPIC_SPREAD_CARD_PADDING = 36;
export const FITPIC_SPREAD_CARD_GAP = 24;
export const FITPIC_SPREAD_PRIMARY_HEIGHT = 228;
export const FITPIC_SPREAD_DETAIL_CELL_SIZE = 54;
export const FITPIC_SPREAD_DETAIL_GAP = 6;
export const FITPIC_SPREAD_MAX_DETAIL_TILES = 9;
export const FITPIC_SPREAD_STANDARD_SCALE = 2;
export const FITPIC_SPREAD_HIGH_QUALITY_SCALE = 3;
export const FITPIC_SPREAD_MAX_CANVAS_DIMENSION = 16384;
export const FITPIC_SPREAD_MAX_CANVAS_PIXELS = 120_000_000;

export const fitpicSpreadExportPresets = {
  compact: {
    scope: "current",
    shuffleFitpics: false,
    useCurrentSortOrder: true,
    showTitle: true,
    showDetailGrid: false,
    showTags: false,
    showFitDate: false
  },
  reference: {
    scope: "current",
    shuffleFitpics: false,
    useCurrentSortOrder: true,
    showTitle: true,
    showDetailGrid: true,
    showTags: false,
    showFitDate: false
  },
  detailed: {
    scope: "current",
    shuffleFitpics: false,
    useCurrentSortOrder: true,
    showTitle: true,
    showDetailGrid: true,
    showTags: true,
    showFitDate: true
  }
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFitpicImageOrder(fitpicImage, fallbackOrder = 0) {
  const numericOrder = Number(fitpicImage?.order);
  return Number.isFinite(numericOrder) ? numericOrder : fallbackOrder;
}

function getFitpicRenderableImageSrc(candidate = {}) {
  return [
    candidate?.primaryImageUrl,
    candidate?.imageUrl,
    ...(Array.isArray(candidate?.imageUrls) ? candidate.imageUrls : []),
    candidate?.images?.original,
    candidate?.images?.preview,
    candidate?.images?.thumbnail,
    candidate?.imageData
  ]
    .map(normalizeString)
    .find(Boolean) || "";
}

function getFitpicRenderableImages(fitpic = {}) {
  const rawFitpicImages = Array.isArray(fitpic?.fitpicImages) ? fitpic.fitpicImages : [];

  if (rawFitpicImages.length > 0) {
    return rawFitpicImages
      .map((fitpicImage, index) => ({
        fitpicImageUuid: normalizeString(fitpicImage?.fitpicImageUuid),
        order: normalizeFitpicImageOrder(fitpicImage, index),
        src: getFitpicRenderableImageSrc(fitpicImage)
      }))
      .filter((fitpicImage) => fitpicImage.src)
      .sort((left, right) => left.order - right.order);
  }

  const normalizedImages = getFitpicImages(fitpic);

  if (normalizedImages.length > 0) {
    return normalizedImages
      .map((fitpicImage, index) => ({
        fitpicImageUuid: normalizeString(fitpicImage?.fitpicImageUuid),
        order: normalizeFitpicImageOrder(fitpicImage, index),
        src: getFitpicRenderableImageSrc(fitpicImage)
      }))
      .filter((fitpicImage) => fitpicImage.src)
      .sort((left, right) => left.order - right.order);
  }

  const fallbackSrc = getFitpicRenderableImageSrc(fitpic);

  return fallbackSrc
    ? [{
        fitpicImageUuid: normalizeString(fitpic?.primaryImageUuid),
        order: 0,
        src: fallbackSrc
      }]
    : [];
}

export function getFitpicSpreadExportPrimaryImage(fitpic = {}) {
  const renderableImages = getFitpicRenderableImages(fitpic);
  const requestedPrimaryImageUuid = normalizeString(fitpic?.primaryImageUuid);

  if (requestedPrimaryImageUuid) {
    const matchingImage = renderableImages.find((fitpicImage) => fitpicImage.fitpicImageUuid === requestedPrimaryImageUuid);

    if (matchingImage) {
      return matchingImage;
    }
  }

  const normalizedPrimaryImage = getPrimaryFitpicImage(fitpic);
  const normalizedPrimaryImageUuid = normalizeString(normalizedPrimaryImage?.fitpicImageUuid);

  if (normalizedPrimaryImageUuid) {
    const matchingImage = renderableImages.find((fitpicImage) => fitpicImage.fitpicImageUuid === normalizedPrimaryImageUuid);

    if (matchingImage) {
      return matchingImage;
    }
  }

  return renderableImages[0] ?? null;
}

export function getFitpicSpreadExportDetailImages(fitpic = {}) {
  const renderableImages = getFitpicRenderableImages(fitpic);
  const primaryImage = getFitpicSpreadExportPrimaryImage(fitpic);

  return renderableImages.filter((fitpicImage) => {
    if (!primaryImage) {
      return true;
    }

    if (primaryImage.fitpicImageUuid && fitpicImage.fitpicImageUuid) {
      return fitpicImage.fitpicImageUuid !== primaryImage.fitpicImageUuid;
    }

    return fitpicImage.src !== primaryImage.src;
  });
}

export function getFitpicSpreadExportDetailTiles(fitpic = {}, maxTiles = FITPIC_SPREAD_MAX_DETAIL_TILES) {
  const detailImages = getFitpicSpreadExportDetailImages(fitpic);

  if (detailImages.length <= maxTiles) {
    return detailImages.map((fitpicImage) => ({
      kind: "image",
      src: fitpicImage.src,
      fitpicImageUuid: fitpicImage.fitpicImageUuid
    }));
  }

  const visibleImages = detailImages.slice(0, Math.max(0, maxTiles - 1));
  const overflowCount = detailImages.length - visibleImages.length;

  return [
    ...visibleImages.map((fitpicImage) => ({
      kind: "image",
      src: fitpicImage.src,
      fitpicImageUuid: fitpicImage.fitpicImageUuid
    })),
    {
      kind: "overflow",
      overflowCount
    }
  ];
}

export function createFitpicSpreadExportOptions(preset = "reference") {
  return { ...(fitpicSpreadExportPresets[preset] ?? fitpicSpreadExportPresets.reference) };
}

export function normalizeFitpicSpreadExportOptions(options = {}) {
  const normalizedOptions = {
    ...createFitpicSpreadExportOptions("reference"),
    ...(options && typeof options === "object" ? options : {})
  };

  normalizedOptions.scope = normalizedOptions.scope === "all" ? "all" : "current";
  normalizedOptions.showTitle = Boolean(normalizedOptions.showTitle);
  normalizedOptions.showDetailGrid = Boolean(normalizedOptions.showDetailGrid);
  normalizedOptions.showTags = Boolean(normalizedOptions.showTags);
  normalizedOptions.showFitDate = Boolean(normalizedOptions.showFitDate);

  if (normalizedOptions.useCurrentSortOrder) {
    normalizedOptions.shuffleFitpics = false;
  } else {
    normalizedOptions.useCurrentSortOrder = false;
    normalizedOptions.shuffleFitpics = Boolean(normalizedOptions.shuffleFitpics);
  }

  return normalizedOptions;
}

export function getFitpicSpreadExportScopedFitpics({
  allFitpics = [],
  visibleFitpics = [],
  sortedFitpics = [],
  options = {}
} = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);

  if (normalizedOptions.scope === "all") {
    return normalizedOptions.useCurrentSortOrder ? [...sortedFitpics] : [...allFitpics];
  }

  return [...visibleFitpics];
}

export function getFitpicSpreadExportOrderedFitpics(fitpics = [], options = {}, random = Math.random) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  const orderedFitpics = Array.isArray(fitpics) ? [...fitpics] : [];

  if (!normalizedOptions.shuffleFitpics) {
    return orderedFitpics;
  }

  for (let index = orderedFitpics.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * (index + 1));
    [orderedFitpics[index], orderedFitpics[swapIndex]] = [orderedFitpics[swapIndex], orderedFitpics[index]];
  }

  return orderedFitpics;
}

export function getFitpicSpreadExportDetailRowCount(fitpic = {}, maxTiles = FITPIC_SPREAD_MAX_DETAIL_TILES) {
  const tileCount = getFitpicSpreadExportDetailTiles(fitpic, maxTiles).length;
  return Math.ceil(tileCount / 3);
}

export function getFitpicSpreadExportCardHeight(options = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  let height = 16 + FITPIC_SPREAD_PRIMARY_HEIGHT + 14;

  if (normalizedOptions.showTitle) {
    height += 34;
  }

  if (normalizedOptions.showDetailGrid) {
    height += FITPIC_SPREAD_DETAIL_CELL_SIZE * 3 + FITPIC_SPREAD_DETAIL_GAP * 2 + 16;
  }

  if (normalizedOptions.showTags) {
    height += 34;
  }

  if (normalizedOptions.showFitDate) {
    height += 20;
  }

  return height + 16;
}

export function getFitpicSpreadExportLayout(fitpicCount, {
  cardWidth = FITPIC_SPREAD_CARD_WIDTH,
  cardHeight = getFitpicSpreadExportCardHeight(),
  cardGap = FITPIC_SPREAD_CARD_GAP,
  padding = FITPIC_SPREAD_CARD_PADDING
} = {}) {
  const normalizedFitpicCount = Math.max(0, Math.floor(Number(fitpicCount) || 0));
  const columns = Math.max(1, Math.ceil(Math.sqrt(normalizedFitpicCount || 1)));
  const rows = Math.max(1, Math.ceil((normalizedFitpicCount || 1) / columns));
  const canvasWidth = columns * cardWidth + Math.max(0, columns - 1) * cardGap + padding * 2;
  const canvasHeight = rows * cardHeight + Math.max(0, rows - 1) * cardGap + padding * 2;

  return {
    cardWidth,
    cardHeight,
    cardGap,
    padding,
    columns,
    rows,
    canvasWidth,
    canvasHeight
  };
}

export function getFitpicSpreadExportRenderConfig(fitpicCount, {
  cardWidth = FITPIC_SPREAD_CARD_WIDTH,
  cardHeight = getFitpicSpreadExportCardHeight(),
  cardGap = FITPIC_SPREAD_CARD_GAP,
  padding = FITPIC_SPREAD_CARD_PADDING,
  qualityScale = FITPIC_SPREAD_HIGH_QUALITY_SCALE,
  maxCanvasDimension = FITPIC_SPREAD_MAX_CANVAS_DIMENSION,
  maxCanvasPixels = FITPIC_SPREAD_MAX_CANVAS_PIXELS
} = {}) {
  const layout = getFitpicSpreadExportLayout(fitpicCount, { cardWidth, cardHeight, cardGap, padding });
  const dimensionLimitedScale = Math.min(
    qualityScale,
    maxCanvasDimension / layout.canvasWidth,
    maxCanvasDimension / layout.canvasHeight
  );
  const pixelLimitedScale = Math.sqrt(maxCanvasPixels / (layout.canvasWidth * layout.canvasHeight));
  const exportScale = Math.max(0.1, Math.min(dimensionLimitedScale, pixelLimitedScale));

  return {
    ...layout,
    qualityScale,
    exportScale,
    pixelWidth: Math.max(1, Math.floor(layout.canvasWidth * exportScale)),
    pixelHeight: Math.max(1, Math.floor(layout.canvasHeight * exportScale))
  };
}
