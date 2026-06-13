import { downloadExportFile } from "./metadataExport.js";
import {
  FITPIC_SPREAD_PRIMARY_HEIGHT,
  createFitpicSpreadExportOptions,
  getFitpicSpreadExportDetailLayout,
  getFitpicSpreadExportDetailTiles,
  getFitpicSpreadExportOrderedFitpics,
  getFitpicSpreadExportPackedRenderConfig,
  getFitpicSpreadExportPrimaryImage,
  normalizeFitpicSpreadExportOptions
} from "./fitpicSpreadExport.js";

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = source;
  });
}

function getDocumentStyles() {
  if (typeof document === "undefined") {
    return null;
  }

  return getComputedStyle(document.documentElement);
}

function drawContainedImage(context, image, frameX, frameY, frameWidth, frameHeight) {
  const scale = Math.min(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight, 1_000);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = frameX + (frameWidth - drawWidth) / 2;
  const drawY = frameY + (frameHeight - drawHeight) / 2;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawFitpicExportOverflowTile(context, label, frameX, frameY, frameWidth, fontFamily, colors, frameHeight = frameWidth) {
  context.fillStyle = colors.panelMuted;
  context.fillRect(frameX, frameY, frameWidth, frameHeight);
  context.strokeStyle = colors.border;
  context.strokeRect(frameX + 0.5, frameY + 0.5, frameWidth - 1, frameHeight - 1);
  context.fillStyle = colors.text;
  context.font = `600 18px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, frameX + frameWidth / 2, frameY + frameHeight / 2);
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

function getWrappedCanvasTextLines(context, text, maxWidth, maxLines = 2) {
  const normalizedText = String(text || "").trim().replace(/\s+/g, " ");

  if (!normalizedText) {
    return [];
  }

  const words = normalizedText.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (!currentLine || context.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, maxLines);
  visibleLines[maxLines - 1] = truncateCanvasText(context, lines.slice(maxLines - 1).join(" "), maxWidth);
  return visibleLines;
}

function formatFitpicDate(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;

  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Date(parsed).toLocaleDateString();
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

export async function renderFitpicImageExport({
  fitpics = [],
  options = createFitpicSpreadExportOptions("reference"),
  resolveAssetUrl = (value) => value,
  fileName = `oa-fitpics-spread-${new Date().toISOString().slice(0, 10)}.png`
} = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  const exportFitpics = getFitpicSpreadExportOrderedFitpics(fitpics, normalizedOptions);

  if (!exportFitpics.length) {
    return null;
  }

  const {
    placements,
    canvasWidth,
    canvasHeight,
    exportScale,
    pixelWidth,
    pixelHeight
  } = getFitpicSpreadExportPackedRenderConfig(exportFitpics, normalizedOptions);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The fitpics image could not be exported.");
  }

  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  context.scale(exportScale, exportScale);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const documentStyles = getDocumentStyles();
  const colors = {
    background: documentStyles?.getPropertyValue("--bg").trim() || "#f7f7f7",
    panel: documentStyles?.getPropertyValue("--surface-solid").trim() || "#ffffff",
    panelMuted: documentStyles?.getPropertyValue("--surface").trim() || "#efefef",
    border: documentStyles?.getPropertyValue("--border-soft").trim() || "rgba(17, 17, 17, 0.12)",
    text: documentStyles?.getPropertyValue("--text").trim() || "#111",
    muted: documentStyles?.getPropertyValue("--muted-strong").trim() || "rgba(17, 17, 17, 0.75)"
  };
  const fontFamily = documentStyles?.getPropertyValue("font-family").trim() || "monospace";

  context.fillStyle = colors.background;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const imageSourcesToLoad = new Map();

  exportFitpics.forEach((fitpic) => {
    const primaryImage = getFitpicSpreadExportPrimaryImage(fitpic);
    const detailTiles = normalizedOptions.showDetailGrid ? getFitpicSpreadExportDetailTiles(fitpic) : [];

    if (primaryImage?.src) {
      imageSourcesToLoad.set(primaryImage.src, resolveAssetUrl(primaryImage.src));
    }

    detailTiles.forEach((tile) => {
      if (tile.kind === "image" && tile.src) {
        imageSourcesToLoad.set(tile.src, resolveAssetUrl(tile.src));
      }
    });
  });

  const loadedImages = new Map(
    await Promise.all(
      [...imageSourcesToLoad.entries()].map(async ([source, resolvedSource]) => [source, await loadImage(resolvedSource)])
    )
  );

  exportFitpics.forEach((fitpic, index) => {
    const placement = placements[index];

    if (!placement) {
      return;
    }

    const cardLeft = placement.x;
    const cardTop = placement.y;
    const exportCardHeight = placement.height;
    const cardWidth = placement.width;
    const cardInnerLeft = cardLeft + 14;
    const cardInnerWidth = cardWidth - 28;
    let cursorY = cardTop + 14;
    const primaryImage = getFitpicSpreadExportPrimaryImage(fitpic);
    const primaryImageLoaded = primaryImage?.src ? loadedImages.get(primaryImage.src) ?? null : null;
    const detailTiles = normalizedOptions.showDetailGrid ? getFitpicSpreadExportDetailTiles(fitpic) : [];
    const detailLayout = getFitpicSpreadExportDetailLayout(detailTiles.length, cardInnerWidth);

    context.fillStyle = colors.panel;
    context.fillRect(cardLeft, cardTop, cardWidth, exportCardHeight);
    context.strokeStyle = colors.border;
    context.strokeRect(cardLeft + 0.5, cardTop + 0.5, cardWidth - 1, exportCardHeight - 1);

    context.fillStyle = colors.panelMuted;
    context.fillRect(cardInnerLeft, cursorY, cardInnerWidth, FITPIC_SPREAD_PRIMARY_HEIGHT);

    if (primaryImageLoaded) {
      drawContainedImage(context, primaryImageLoaded, cardInnerLeft, cursorY, cardInnerWidth, FITPIC_SPREAD_PRIMARY_HEIGHT);
    }

    cursorY += FITPIC_SPREAD_PRIMARY_HEIGHT + 10;

    if (normalizedOptions.showTitle) {
      context.fillStyle = colors.text;
      context.font = `600 16px ${fontFamily}`;
      context.textAlign = "left";
      context.textBaseline = "top";

      const titleLines = getWrappedCanvasTextLines(context, fitpic.name || "Untitled fitpic", cardInnerWidth, 2);
      titleLines.forEach((line, lineIndex) => {
        context.fillText(line, cardInnerLeft, cursorY + lineIndex * 18, cardInnerWidth);
      });
      cursorY += 34;
    }

    if (normalizedOptions.showDetailGrid) {
      detailTiles.forEach((tile, tileIndex) => {
        const tileFrame = detailLayout.frames[tileIndex];

        if (!tileFrame) {
          return;
        }

        const tileX = cardInnerLeft + tileFrame.x;
        const tileY = cursorY + tileFrame.y;

        if (tile.kind === "overflow") {
          drawFitpicExportOverflowTile(
            context,
            `+${tile.overflowCount}`,
            tileX,
            tileY,
            tileFrame.width,
            fontFamily,
            colors,
            tileFrame.height
          );
          return;
        }

        const detailImage = loadedImages.get(tile.src) ?? null;
        context.fillStyle = colors.panelMuted;
        context.fillRect(tileX, tileY, tileFrame.width, tileFrame.height);

        if (detailImage) {
          drawContainedImage(context, detailImage, tileX, tileY, tileFrame.width, tileFrame.height);
        }
      });

      cursorY += detailLayout.totalHeight + 8;
    }

    if (normalizedOptions.showTags) {
      context.fillStyle = colors.muted;
      context.font = `500 12px ${fontFamily}`;
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillText(
        truncateCanvasText(context, (Array.isArray(fitpic.tags) ? fitpic.tags.join(" • ") : "") || "No tags", cardInnerWidth),
        cardInnerLeft,
        cursorY,
        cardInnerWidth
      );
      cursorY += 24;
    }

    if (normalizedOptions.showFitDate) {
      context.fillStyle = colors.muted;
      context.font = `500 12px ${fontFamily}`;
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillText(
        truncateCanvasText(context, formatFitpicDate(fitpic.fitDate || fitpic.createdAt) || "No fit date", cardInnerWidth),
        cardInnerLeft,
        cursorY,
        cardInnerWidth
      );
    }
  });

  return {
    blob: await canvasToBlob(canvas),
    fileName
  };
}

export async function downloadFitpicImageExport(config = {}) {
  const result = await renderFitpicImageExport(config);

  if (!result) {
    return null;
  }

  downloadExportFile(await result.blob.arrayBuffer(), {
    filename: result.fileName,
    mimeType: "image/png"
  });

  return result;
}
