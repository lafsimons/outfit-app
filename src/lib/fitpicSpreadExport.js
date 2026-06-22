import { getFitpicImages, getPrimaryFitpicImage } from "./fitpics.js";

export const FITPIC_SPREAD_CARD_WIDTH = 308;
export const FITPIC_SPREAD_CARD_PADDING = 36;
export const FITPIC_SPREAD_CARD_GAP = 24;
export const FITPIC_SPREAD_PRIMARY_HEIGHT = 228;
export const FITPIC_SPREAD_DETAIL_ROW_HEIGHT = 82;
export const FITPIC_SPREAD_DETAIL_GAP = 3;
export const FITPIC_SPREAD_MAX_DETAIL_TILES = 9;
export const FITPIC_SPREAD_DEFAULT_MAX_DETAIL_IMAGES = FITPIC_SPREAD_MAX_DETAIL_TILES;
export const FITPIC_SPREAD_TITLE_LINE_HEIGHT = 18;
export const FITPIC_SPREAD_TITLE_MAX_LINES = 2;
export const FITPIC_DETAILS_ONLY_CARD_WIDTH = 412;
export const FITPIC_DETAILS_ONLY_CARD_PADDING = 24;
export const FITPIC_DETAILS_ONLY_CARD_GAP = 18;
export const FITPIC_DETAILS_ONLY_CONTENT_INSET = 10;
export const FITPIC_DETAILS_ONLY_DETAIL_ROW_HEIGHT = 148;
export const FITPIC_DETAILS_ONLY_DETAIL_GAP = 6;
export const FITPIC_DETAILS_ONLY_TITLE_LINE_HEIGHT = 16;
export const FITPIC_DETAILS_ONLY_TITLE_MAX_LINES = 1;
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
    showFitDate: false,
    imageMode: "default",
    showDescription: false
  },
  reference: {
    scope: "current",
    shuffleFitpics: false,
    useCurrentSortOrder: true,
    showTitle: true,
    showDetailGrid: true,
    showTags: false,
    showFitDate: false,
    imageMode: "default",
    showDescription: false
  },
  detailsOnly: {
    scope: "current",
    shuffleFitpics: false,
    useCurrentSortOrder: true,
    showTitle: true,
    showDetailGrid: true,
    showTags: false,
    showFitDate: false,
    imageMode: "detailsOnly",
    showDescription: false
  },
  detailed: {
    scope: "current",
    shuffleFitpics: false,
    useCurrentSortOrder: true,
    showTitle: true,
    showDetailGrid: true,
    showTags: true,
    showFitDate: true,
    imageMode: "default",
    showDescription: false
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

export function getFitpicSpreadExportCardImages(fitpic = {}, options = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  if (normalizedOptions.imageMode === "detailsOnly") {
    return getFitpicSpreadExportDetailImages(fitpic);
  }

  const primaryImage = getFitpicSpreadExportPrimaryImage(fitpic);
  return primaryImage ? [primaryImage] : [];
}

export function getFitpicSpreadExportDetailTiles(fitpic = {}, maxTiles = FITPIC_SPREAD_MAX_DETAIL_TILES, options = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  const detailImages = normalizedOptions.imageMode === "detailsOnly"
    ? getFitpicSpreadExportDetailImages(fitpic)
    : getFitpicSpreadExportDetailImages(fitpic);

  if (normalizedOptions.imageMode === "detailsOnly") {
    return detailImages.map((fitpicImage) => ({
      kind: "image",
      src: fitpicImage.src,
      fitpicImageUuid: fitpicImage.fitpicImageUuid
    }));
  }

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
  normalizedOptions.showDescription = Boolean(normalizedOptions.showDescription);
  normalizedOptions.imageMode = normalizedOptions.imageMode === "detailsOnly" ? "detailsOnly" : "default";

  if (normalizedOptions.useCurrentSortOrder) {
    normalizedOptions.shuffleFitpics = false;
  } else {
    normalizedOptions.useCurrentSortOrder = false;
    normalizedOptions.shuffleFitpics = Boolean(normalizedOptions.shuffleFitpics);
  }

  if (normalizedOptions.maxDetailImages === undefined || normalizedOptions.maxDetailImages === null) {
    normalizedOptions.maxDetailImages = FITPIC_SPREAD_DEFAULT_MAX_DETAIL_IMAGES;
  } else {
    normalizedOptions.maxDetailImages = Math.max(0, Math.floor(Number(normalizedOptions.maxDetailImages) || 0));
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

export function fitpicHasSpreadExportImages(fitpic = {}, options = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);

  if (normalizedOptions.imageMode === "detailsOnly") {
    return getFitpicSpreadExportDetailImages(fitpic).length > 0;
  }

  return getFitpicRenderableImages(fitpic).length > 0;
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
  if (tileCount <= 0) {
    return 0;
  }

  if (tileCount === 1 || tileCount === 2) {
    return 1;
  }

  return Math.ceil(tileCount / 3);
}

export function getFitpicSpreadExportLayoutMetrics(options = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);

  if (normalizedOptions.imageMode === "detailsOnly") {
    return {
      cardWidth: FITPIC_DETAILS_ONLY_CARD_WIDTH,
      cardPadding: FITPIC_DETAILS_ONLY_CARD_PADDING,
      cardGap: FITPIC_DETAILS_ONLY_CARD_GAP,
      contentInset: FITPIC_DETAILS_ONLY_CONTENT_INSET,
      detailGap: FITPIC_DETAILS_ONLY_DETAIL_GAP,
      detailRowHeight: FITPIC_DETAILS_ONLY_DETAIL_ROW_HEIGHT,
      titleLineHeight: FITPIC_DETAILS_ONLY_TITLE_LINE_HEIGHT,
      titleMaxLines: FITPIC_DETAILS_ONLY_TITLE_MAX_LINES,
      titleBlockHeight: FITPIC_DETAILS_ONLY_TITLE_LINE_HEIGHT + 4
    };
  }

  return {
    cardWidth: FITPIC_SPREAD_CARD_WIDTH,
    cardPadding: FITPIC_SPREAD_CARD_PADDING,
    cardGap: FITPIC_SPREAD_CARD_GAP,
    contentInset: 14,
    detailGap: FITPIC_SPREAD_DETAIL_GAP,
    detailRowHeight: FITPIC_SPREAD_DETAIL_ROW_HEIGHT,
    titleLineHeight: FITPIC_SPREAD_TITLE_LINE_HEIGHT,
    titleMaxLines: FITPIC_SPREAD_TITLE_MAX_LINES,
    titleBlockHeight: FITPIC_SPREAD_TITLE_LINE_HEIGHT * FITPIC_SPREAD_TITLE_MAX_LINES + 2
  };
}

export function getFitpicSpreadExportDetailColumns(tileCount = 0, options = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  if (tileCount <= 1) {
    return 1;
  }

  if (normalizedOptions.imageMode === "detailsOnly") {
    return 2;
  }

  if (tileCount <= 4) {
    return 2;
  }

  return 3;
}

export function getFitpicSpreadExportDetailLayout(tileCount = 0, availableWidth = 0, {
  gap = FITPIC_SPREAD_DETAIL_GAP,
  rowHeight = FITPIC_SPREAD_DETAIL_ROW_HEIGHT,
  options = {}
} = {}) {
  const normalizedTileCount = Math.max(0, Math.floor(Number(tileCount) || 0));
  const normalizedWidth = Math.max(0, Number(availableWidth) || 0);

  if (!normalizedTileCount || !normalizedWidth) {
    return {
      columns: 0,
      rowCount: 0,
      frames: [],
      totalHeight: 0
    };
  }

  const columns = getFitpicSpreadExportDetailColumns(normalizedTileCount, options);
  const rowCount = columns <= 0 ? 0 : Math.ceil(normalizedTileCount / columns);
  const cellWidth = columns === 1
    ? normalizedWidth
    : (normalizedWidth - gap * (columns - 1)) / columns;
  const frames = Array.from({ length: normalizedTileCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      x: column * (cellWidth + gap),
      y: row * (rowHeight + gap),
      width: cellWidth,
      height: rowHeight
    };
  });

  return {
    columns,
    rowCount,
    frames,
    totalHeight: rowCount * rowHeight + Math.max(0, rowCount - 1) * gap
  };
}

export function getFitpicSpreadExportCardHeight(options = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  const metrics = getFitpicSpreadExportLayoutMetrics(normalizedOptions);
  let height = metrics.contentInset;

  if (normalizedOptions.imageMode !== "detailsOnly") {
    height += FITPIC_SPREAD_PRIMARY_HEIGHT + 10;
  }

  if (normalizedOptions.showTitle) {
    height += metrics.titleBlockHeight;
  }

  if (normalizedOptions.showDetailGrid) {
    const detailRows = normalizedOptions.imageMode === "detailsOnly" ? 2 : 3;
    height += metrics.detailRowHeight * detailRows + metrics.detailGap * Math.max(0, detailRows - 1) + 10;
  }

  if (normalizedOptions.showDescription) {
    height += 36;
  }

  if (normalizedOptions.showTags) {
    height += 24;
  }

  if (normalizedOptions.showFitDate) {
    height += 18;
  }

  return height + metrics.contentInset;
}

export function getFitpicSpreadExportCardHeightForFitpic(fitpic = {}, options = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  const metrics = getFitpicSpreadExportLayoutMetrics(normalizedOptions);
  const detailTiles = normalizedOptions.showDetailGrid
    ? getFitpicSpreadExportDetailTiles(fitpic, normalizedOptions.maxDetailImages, normalizedOptions)
    : [];
  const detailLayout = getFitpicSpreadExportDetailLayout(
    detailTiles.length,
    metrics.cardWidth - metrics.contentInset * 2,
    {
      gap: metrics.detailGap,
      rowHeight: metrics.detailRowHeight,
      options: normalizedOptions
    }
  );
  let height = metrics.contentInset;

  if (normalizedOptions.imageMode !== "detailsOnly") {
    height += FITPIC_SPREAD_PRIMARY_HEIGHT + 10;
  }

  if (normalizedOptions.showTitle) {
    height += metrics.titleBlockHeight;
  }

  if (normalizedOptions.showDetailGrid && detailLayout.totalHeight > 0) {
    height += detailLayout.totalHeight + 10;
  }

  if (normalizedOptions.showDescription) {
    height += 36;
  }

  if (normalizedOptions.showTags) {
    height += 24;
  }

  if (normalizedOptions.showFitDate) {
    height += 18;
  }

  return height + metrics.contentInset;
}

export function getFitpicSpreadExportColumnCount(fitpicCount) {
  const normalizedFitpicCount = Math.max(0, Math.floor(Number(fitpicCount) || 0));
  return Math.max(1, Math.ceil(Math.sqrt(normalizedFitpicCount || 1)));
}

export function getFitpicSpreadExportPlacements(fitpics = [], options = {}, {
  cardWidth,
  cardGap,
  padding
} = {}) {
  const metrics = getFitpicSpreadExportLayoutMetrics(options);
  const resolvedCardWidth = cardWidth ?? metrics.cardWidth;
  const resolvedCardGap = cardGap ?? metrics.cardGap;
  const resolvedPadding = padding ?? metrics.cardPadding;
  const columns = getFitpicSpreadExportColumnCount(fitpics.length);
  const columnHeights = Array.from({ length: columns }, () => resolvedPadding);

  return (Array.isArray(fitpics) ? fitpics : []).map((fitpic, index) => {
    const cardHeight = getFitpicSpreadExportCardHeightForFitpic(fitpic, options);
    let column = 0;

    for (let candidateColumn = 1; candidateColumn < columns; candidateColumn += 1) {
      if (columnHeights[candidateColumn] < columnHeights[column]) {
        column = candidateColumn;
      }
    }

    const placement = {
      index,
      column,
      x: resolvedPadding + column * (resolvedCardWidth + resolvedCardGap),
      y: columnHeights[column],
      width: resolvedCardWidth,
      height: cardHeight
    };

    columnHeights[column] += cardHeight + resolvedCardGap;
    return placement;
  });
}

export function getFitpicSpreadExportLayout(fitpicCount, {
  cardWidth = FITPIC_SPREAD_CARD_WIDTH,
  cardHeight = getFitpicSpreadExportCardHeight(),
  cardGap = FITPIC_SPREAD_CARD_GAP,
  padding = FITPIC_SPREAD_CARD_PADDING
} = {}) {
  const normalizedFitpicCount = Math.max(0, Math.floor(Number(fitpicCount) || 0));
  const columns = getFitpicSpreadExportColumnCount(normalizedFitpicCount);
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

export function getFitpicSpreadExportPackedRenderConfig(fitpics = [], options = {}, {
  cardWidth,
  cardGap,
  padding,
  qualityScale = FITPIC_SPREAD_HIGH_QUALITY_SCALE,
  maxCanvasDimension = FITPIC_SPREAD_MAX_CANVAS_DIMENSION,
  maxCanvasPixels = FITPIC_SPREAD_MAX_CANVAS_PIXELS
} = {}) {
  const metrics = getFitpicSpreadExportLayoutMetrics(options);
  const resolvedCardWidth = cardWidth ?? metrics.cardWidth;
  const resolvedCardGap = cardGap ?? metrics.cardGap;
  const resolvedPadding = padding ?? metrics.cardPadding;
  const placements = getFitpicSpreadExportPlacements(fitpics, options, {
    cardWidth: resolvedCardWidth,
    cardGap: resolvedCardGap,
    padding: resolvedPadding
  });
  const columns = getFitpicSpreadExportColumnCount(fitpics.length);
  const canvasWidth = columns * resolvedCardWidth + Math.max(0, columns - 1) * resolvedCardGap + resolvedPadding * 2;
  const contentBottom = placements.length
    ? Math.max(...placements.map((placement) => placement.y + placement.height))
    : resolvedPadding;
  const canvasHeight = contentBottom + resolvedPadding;
  const dimensionLimitedScale = Math.min(
    qualityScale,
    maxCanvasDimension / canvasWidth,
    maxCanvasDimension / canvasHeight
  );
  const pixelLimitedScale = Math.sqrt(maxCanvasPixels / (canvasWidth * canvasHeight));
  const exportScale = Math.max(0.1, Math.min(dimensionLimitedScale, pixelLimitedScale));

  return {
    placements,
    columns,
    cardWidth: resolvedCardWidth,
    cardGap: resolvedCardGap,
    padding: resolvedPadding,
    canvasWidth,
    canvasHeight,
    qualityScale,
    exportScale,
    pixelWidth: Math.max(1, Math.floor(canvasWidth * exportScale)),
    pixelHeight: Math.max(1, Math.floor(canvasHeight * exportScale))
  };
}
