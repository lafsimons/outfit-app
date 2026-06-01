export const WARDROBE_SPREAD_CELL_SIZE = 190;
export const WARDROBE_SPREAD_PADDING = 44;
export const WARDROBE_SPREAD_STANDARD_SCALE = 2;
export const WARDROBE_SPREAD_HIGH_QUALITY_SCALE = 3;
export const WARDROBE_SPREAD_MAX_CANVAS_DIMENSION = 16384;
export const WARDROBE_SPREAD_MAX_CANVAS_PIXELS = 120_000_000;

function getImageAssetSrc(asset) {
  if (typeof asset === "string") {
    return asset.trim();
  }

  if (asset && typeof asset === "object" && typeof asset.src === "string") {
    return asset.src.trim();
  }

  return "";
}

export function getWardrobeSpreadExportImageUrl(item = {}) {
  return (
    getImageAssetSrc(item?.images?.display) ||
    getImageAssetSrc(item?.images?.preview) ||
    getImageAssetSrc(item?.imageUrl) ||
    ""
  );
}

export function getWardrobeSpreadExportLayout(itemCount, {
  cellSize = WARDROBE_SPREAD_CELL_SIZE,
  padding = WARDROBE_SPREAD_PADDING
} = {}) {
  const normalizedItemCount = Math.max(0, Math.floor(Number(itemCount) || 0));
  const columns = Math.max(1, Math.ceil(Math.sqrt(normalizedItemCount * 1.18)));
  const rows = Math.max(1, Math.ceil(normalizedItemCount / columns));
  const canvasWidth = columns * cellSize + padding * 2;
  const canvasHeight = rows * cellSize + padding * 2;

  return {
    cellSize,
    padding,
    columns,
    rows,
    canvasWidth,
    canvasHeight
  };
}

export function getWardrobeSpreadExportRenderConfig(itemCount, {
  cellSize = WARDROBE_SPREAD_CELL_SIZE,
  padding = WARDROBE_SPREAD_PADDING,
  qualityScale = WARDROBE_SPREAD_HIGH_QUALITY_SCALE,
  maxCanvasDimension = WARDROBE_SPREAD_MAX_CANVAS_DIMENSION,
  maxCanvasPixels = WARDROBE_SPREAD_MAX_CANVAS_PIXELS
} = {}) {
  const layout = getWardrobeSpreadExportLayout(itemCount, { cellSize, padding });
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
