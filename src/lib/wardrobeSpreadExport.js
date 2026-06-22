import { getActiveWardrobeItemImageAsset } from "./itemModel.js";

export const WARDROBE_SPREAD_CELL_SIZE = 190;
export const WARDROBE_SPREAD_PADDING = 44;
export const WARDROBE_SPREAD_STANDARD_SCALE = 2;
export const WARDROBE_SPREAD_HIGH_QUALITY_SCALE = 3;
export const WARDROBE_SPREAD_MAX_CANVAS_DIMENSION = 16384;
export const WARDROBE_SPREAD_MAX_CANVAS_PIXELS = 120_000_000;
export const WARDROBE_SPREAD_LABEL_FONT_SIZE = 11;
export const WARDROBE_SPREAD_LABEL_LINE_HEIGHT = 14;
export const WARDROBE_SPREAD_LABEL_GAP = 3;
export const WARDROBE_SPREAD_LABEL_TOP_GAP = 10;
export const WARDROBE_SPREAD_LABEL_SIDE_PADDING = 8;

export const wardrobeSpreadExportPresets = {
  compact: {
    shuffleItems: true,
    useCurrentSortOrder: false,
    showItemName: false,
    showBrand: false,
    showId: false
  },
  reference: {
    shuffleItems: false,
    useCurrentSortOrder: true,
    showItemName: true,
    showBrand: false,
    showId: false
  },
  detailed: {
    shuffleItems: false,
    useCurrentSortOrder: true,
    showItemName: true,
    showBrand: true,
    showId: false
  }
};

function getImageAssetSrc(asset) {
  if (typeof asset === "string") {
    return asset.trim();
  }

  if (asset && typeof asset === "object" && typeof asset.src === "string") {
    return asset.src.trim();
  }

  return "";
}

function getWardrobeAssetSourceCandidates(asset, sourceTypePrefix) {
  const normalizedAsset = asset && typeof asset === "object" ? asset : {};

  return [
    {
      src: getImageAssetSrc(normalizedAsset?.images?.original),
      sourceType: `${sourceTypePrefix}:original`
    },
    {
      src: getImageAssetSrc(normalizedAsset?.images?.display),
      sourceType: `${sourceTypePrefix}:display`
    },
    {
      src: getImageAssetSrc(normalizedAsset?.images?.preview),
      sourceType: `${sourceTypePrefix}:preview`
    },
    {
      src: getImageAssetSrc(normalizedAsset?.imageUrl),
      sourceType: `${sourceTypePrefix}:imageUrl`
    },
    {
      src: getImageAssetSrc(normalizedAsset?.src),
      sourceType: `${sourceTypePrefix}:src`
    },
    {
      src: getImageAssetSrc(normalizedAsset?.dataUrl),
      sourceType: `${sourceTypePrefix}:dataUrl`
    },
    {
      src: getImageAssetSrc(normalizedAsset?.imageData),
      sourceType: `${sourceTypePrefix}:imageData`
    },
    {
      src: getImageAssetSrc(normalizedAsset?.images?.thumbnail),
      sourceType: `${sourceTypePrefix}:thumbnail`
    }
  ];
}

export function getWardrobeSpreadExportImageSource(item = {}) {
  const activeAsset = getActiveWardrobeItemImageAsset(item);
  const candidates = [
    ...getWardrobeAssetSourceCandidates(activeAsset, "active-asset"),
    ...getWardrobeAssetSourceCandidates(item, "item"),
    {
      src: getImageAssetSrc(item?.imageUrl),
      sourceType: "legacy:imageUrl"
    }
  ];

  return candidates.find((candidate) => candidate.src) ?? {
    src: "",
    sourceType: "missing"
  };
}

export function getWardrobeSpreadExportImageUrl(item = {}) {
  return getWardrobeSpreadExportImageSource(item).src;
}

export function createWardrobeSpreadExportOptions(preset = "compact") {
  return { ...(wardrobeSpreadExportPresets[preset] ?? wardrobeSpreadExportPresets.compact) };
}

export function normalizeWardrobeSpreadExportOptions(options = {}) {
  const normalizedOptions = {
    ...createWardrobeSpreadExportOptions("compact"),
    ...(options && typeof options === "object" ? options : {})
  };

  if (normalizedOptions.useCurrentSortOrder) {
    normalizedOptions.shuffleItems = false;
  } else {
    normalizedOptions.shuffleItems = true;
    normalizedOptions.useCurrentSortOrder = false;
  }

  normalizedOptions.showItemName = Boolean(normalizedOptions.showItemName);
  normalizedOptions.showBrand = Boolean(normalizedOptions.showBrand);
  normalizedOptions.showId = Boolean(normalizedOptions.showId);

  return normalizedOptions;
}

export function getWardrobeSpreadExportLabelRows(item = {}, options = {}) {
  const normalizedOptions = normalizeWardrobeSpreadExportOptions(options);
  const rows = [];

  if (normalizedOptions.showItemName) {
    rows.push({
      key: "name",
      text: item.name?.trim() || item.garmentType?.trim() || "Untitled item"
    });
  }

  if (normalizedOptions.showBrand) {
    rows.push({
      key: "brand",
      text: item.brand?.trim() || ""
    });
  }

  if (normalizedOptions.showId) {
    rows.push({
      key: "id",
      text: item.id?.trim() || ""
    });
  }

  return rows;
}

export function getWardrobeSpreadExportLabelRowCount(options = {}) {
  return getWardrobeSpreadExportLabelRows({}, options).length;
}

export function getWardrobeSpreadExportOrderedItems(items = [], options = {}, random = Math.random) {
  const normalizedOptions = normalizeWardrobeSpreadExportOptions(options);
  const orderedItems = Array.isArray(items) ? [...items] : [];

  if (!normalizedOptions.shuffleItems) {
    return orderedItems;
  }

  for (let index = orderedItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * (index + 1));
    [orderedItems[index], orderedItems[swapIndex]] = [orderedItems[swapIndex], orderedItems[index]];
  }

  return orderedItems;
}

export function getWardrobeSpreadExportLayout(itemCount, {
  cellSize = WARDROBE_SPREAD_CELL_SIZE,
  padding = WARDROBE_SPREAD_PADDING,
  labelRowCount = 0
} = {}) {
  const normalizedItemCount = Math.max(0, Math.floor(Number(itemCount) || 0));
  const normalizedLabelRowCount = Math.max(0, Math.floor(Number(labelRowCount) || 0));
  const columns = Math.max(1, Math.ceil(Math.sqrt(normalizedItemCount * 1.18)));
  const rows = Math.max(1, Math.ceil(normalizedItemCount / columns));
  const labelAreaHeight = normalizedLabelRowCount > 0
    ? WARDROBE_SPREAD_LABEL_TOP_GAP
      + normalizedLabelRowCount * WARDROBE_SPREAD_LABEL_LINE_HEIGHT
      + Math.max(0, normalizedLabelRowCount - 1) * WARDROBE_SPREAD_LABEL_GAP
    : 0;
  const cellHeight = cellSize + labelAreaHeight;
  const canvasWidth = columns * cellSize + padding * 2;
  const canvasHeight = rows * cellHeight + padding * 2;

  return {
    cellSize,
    cellHeight,
    padding,
    labelRowCount: normalizedLabelRowCount,
    labelAreaHeight,
    columns,
    rows,
    canvasWidth,
    canvasHeight
  };
}

export function getWardrobeSpreadExportRenderConfig(itemCount, {
  cellSize = WARDROBE_SPREAD_CELL_SIZE,
  padding = WARDROBE_SPREAD_PADDING,
  labelRowCount = 0,
  qualityScale = WARDROBE_SPREAD_HIGH_QUALITY_SCALE,
  maxCanvasDimension = WARDROBE_SPREAD_MAX_CANVAS_DIMENSION,
  maxCanvasPixels = WARDROBE_SPREAD_MAX_CANVAS_PIXELS
} = {}) {
  const layout = getWardrobeSpreadExportLayout(itemCount, { cellSize, padding, labelRowCount });
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
