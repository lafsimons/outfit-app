import { downloadExportFile } from "./metadataExport.js";
import { getManagedImageDrawBox, getManagedImageSourceRect } from "./imagePresentation.js";
import {
  WARDROBE_SPREAD_LABEL_FONT_SIZE,
  WARDROBE_SPREAD_LABEL_GAP,
  WARDROBE_SPREAD_LABEL_LINE_HEIGHT,
  WARDROBE_SPREAD_LABEL_SIDE_PADDING,
  WARDROBE_SPREAD_LABEL_TOP_GAP,
  getWardrobeSpreadExportImageUrl,
  getWardrobeSpreadExportLabelRowCount,
  getWardrobeSpreadExportLabelRows,
  getWardrobeSpreadExportOrderedItems,
  getWardrobeSpreadExportRenderConfig,
  normalizeWardrobeSpreadExportOptions
} from "./wardrobeSpreadExport.js";

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = source;
  });
}

function truncateCanvasText(context, text, maxWidth) {
  const normalizedText = String(text || "").trim();

  if (!normalizedText || context.measureText(normalizedText).width <= maxWidth) {
    return normalizedText;
  }

  const ellipsis = "...";
  let truncatedText = normalizedText;

  while (truncatedText.length > 0) {
    truncatedText = truncatedText.slice(0, -1).trimEnd();

    if (context.measureText(`${truncatedText}${ellipsis}`).width <= maxWidth) {
      return `${truncatedText}${ellipsis}`;
    }
  }

  return ellipsis;
}

function drawManagedImageToCanvas(context, item, image, frameX, frameY, frameWidth, frameHeight) {
  const { sourceRect, drawX, drawY, drawWidth, drawHeight } = getManagedImageDrawBox(
    item,
    image,
    frameX,
    frameY,
    frameWidth,
    frameHeight
  );

  context.save();
  context.beginPath();
  context.rect(frameX, frameY, frameWidth, frameHeight);
  context.clip();
  context.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  context.restore();
}

function getDocumentStyles() {
  if (typeof document === "undefined") {
    return null;
  }

  return getComputedStyle(document.documentElement);
}

async function canvasToBlob(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

  if (blob) {
    return blob;
  }

  const dataUrl = canvas.toDataURL("image/png");
  const response = await fetch(dataUrl);
  return response.blob();
}

export async function renderWardrobeImageExport({
  items = [],
  options = {},
  resolveAssetUrl = (value) => value,
  fileName = `oa-wardrobe-export-${new Date().toISOString().slice(0, 10)}.png`,
  random = Math.random
} = {}) {
  const normalizedOptions = normalizeWardrobeSpreadExportOptions(options);
  const exportItems = getWardrobeSpreadExportOrderedItems(items, normalizedOptions, random);

  if (!exportItems.length) {
    return null;
  }

  const labelRowCount = getWardrobeSpreadExportLabelRowCount(normalizedOptions);
  const {
    cellHeight,
    cellSize,
    columns,
    padding,
    canvasWidth,
    canvasHeight,
    exportScale,
    pixelWidth,
    pixelHeight
  } = getWardrobeSpreadExportRenderConfig(exportItems.length, { labelRowCount });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The wardrobe image could not be exported.");
  }

  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  context.scale(exportScale, exportScale);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const documentStyles = getDocumentStyles();
  const exportBackgroundColor = documentStyles?.getPropertyValue("--bg").trim() || "#f7f7f7";
  const exportTextColor = documentStyles?.getPropertyValue("--text").trim() || "#111";
  const exportMutedTextColor = documentStyles?.getPropertyValue("--muted-strong").trim() || "rgba(17, 17, 17, 0.75)";
  const exportFontFamily = documentStyles?.getPropertyValue("font-family").trim() || "monospace";

  context.fillStyle = exportBackgroundColor;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const loadedItems = await Promise.all(
    exportItems.map(async (item) => {
      const exportImageUrl = resolveAssetUrl(getWardrobeSpreadExportImageUrl(item));

      if (!exportImageUrl) {
        throw new Error("Missing export image.");
      }

      return {
        item,
        image: await loadImage(exportImageUrl)
      };
    })
  );

  loadedItems.forEach(({ item, image }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellLeft = padding + column * cellSize;
    const cellTop = padding + row * cellHeight;
    const maxImageSize = cellSize * 0.78;
    const sourceRect = getManagedImageSourceRect(item, image.naturalWidth, image.naturalHeight);
    const baseScale = Math.min(maxImageSize / sourceRect.width, maxImageSize / sourceRect.height, 1);
    const frameWidth = sourceRect.width * baseScale;
    const frameHeight = sourceRect.height * baseScale;
    const jitterX = normalizedOptions.shuffleItems ? (random() - 0.5) * cellSize * 0.22 : 0;
    const jitterY = normalizedOptions.shuffleItems ? (random() - 0.5) * cellSize * 0.22 : 0;
    const frameX = cellLeft + (cellSize - frameWidth) / 2 + jitterX;
    const frameY = cellTop + (cellSize - frameHeight) / 2 + jitterY;
    const labelRows = getWardrobeSpreadExportLabelRows(item, normalizedOptions);

    drawManagedImageToCanvas(context, item, image, frameX, frameY, frameWidth, frameHeight);

    if (!labelRows.length) {
      return;
    }

    context.textAlign = "center";
    context.textBaseline = "top";
    context.font = `500 ${WARDROBE_SPREAD_LABEL_FONT_SIZE}px ${exportFontFamily}`;

    labelRows.forEach(({ key, text }, labelIndex) => {
      if (!text) {
        return;
      }

      const textY = cellTop
        + cellSize
        + WARDROBE_SPREAD_LABEL_TOP_GAP
        + labelIndex * (WARDROBE_SPREAD_LABEL_LINE_HEIGHT + WARDROBE_SPREAD_LABEL_GAP);
      const textWidth = cellSize - WARDROBE_SPREAD_LABEL_SIDE_PADDING * 2;
      const displayText = truncateCanvasText(context, text, textWidth);

      context.fillStyle = key === "name" ? exportTextColor : exportMutedTextColor;
      context.fillText(displayText, cellLeft + cellSize / 2, textY, textWidth);
    });
  });

  return {
    blob: await canvasToBlob(canvas),
    fileName
  };
}

export async function downloadWardrobeImageExport(config = {}) {
  const result = await renderWardrobeImageExport(config);

  if (!result) {
    return null;
  }

  downloadExportFile(await result.blob.arrayBuffer(), {
    filename: result.fileName,
    mimeType: "image/png"
  });

  return result;
}
