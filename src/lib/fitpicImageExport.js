import { downloadExportFile } from "./metadataExport.js";
import {
  FITPIC_SPREAD_DEFAULT_MAX_DETAIL_IMAGES,
  FITPIC_SPREAD_PRIMARY_HEIGHT,
  fitpicHasSpreadExportImages,
  createFitpicSpreadExportOptions,
  getFitpicSpreadExportCardImages,
  getFitpicSpreadExportDetailLayout,
  getFitpicSpreadExportLayoutMetrics,
  getFitpicSpreadExportDetailTiles,
  getFitpicSpreadExportOrderedFitpics,
  getFitpicSpreadExportPackedRenderConfig,
  normalizeFitpicSpreadExportOptions
} from "./fitpicSpreadExport.js";

export const FITPIC_IMAGE_EXPORT_TARGET_BYTES = 30 * 1024 * 1024;

export const fitpicImageExportProfiles = {
  png: {
    format: "png",
    quality: null,
    qualityScale: null,
    maxDetailImages: FITPIC_SPREAD_DEFAULT_MAX_DETAIL_IMAGES,
    adaptiveQuality: [],
    adaptiveScale: [],
    targetBytes: null
  },
  ai: {
    format: "webp",
    quality: 0.96,
    qualityScale: 5,
    maxDetailImages: 4,
    adaptiveQuality: [0.94, 0.9],
    adaptiveScale: [4.5, 4, 3.5, 3],
    targetBytes: FITPIC_IMAGE_EXPORT_TARGET_BYTES
  },
  detailsAi: {
    format: "webp",
    quality: 0.96,
    qualityScale: 5,
    maxDetailImages: Number.POSITIVE_INFINITY,
    adaptiveQuality: [0.94, 0.9],
    adaptiveScale: [4.5, 4, 3.5, 3],
    targetBytes: FITPIC_IMAGE_EXPORT_TARGET_BYTES
  },
  compactSharing: {
    format: "webp",
    quality: 0.78,
    qualityScale: 1.5,
    maxDetailImages: FITPIC_SPREAD_DEFAULT_MAX_DETAIL_IMAGES,
    adaptiveQuality: [],
    adaptiveScale: [],
    targetBytes: null
  },
  archivalWebp: {
    format: "webp",
    quality: 0.9,
    qualityScale: 2,
    maxDetailImages: FITPIC_SPREAD_DEFAULT_MAX_DETAIL_IMAGES,
    adaptiveQuality: [],
    adaptiveScale: [],
    targetBytes: null
  }
};

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

function resolveFitpicImageExportProfile(profile = "png", overrides = {}) {
  const resolvedProfile = typeof profile === "string"
    ? fitpicImageExportProfiles[profile] ?? fitpicImageExportProfiles.png
    : fitpicImageExportProfiles.png;

  return {
    ...resolvedProfile,
    ...(overrides && typeof overrides === "object" ? overrides : {})
  };
}

function createFitpicExportEncodingPlan(profile = {}) {
  const format = profile.format === "webp" ? "webp" : "png";
  const qualityValues = [];
  const scaleValues = [];

  if (Number.isFinite(profile.quality)) {
    qualityValues.push(profile.quality);
  }

  (Array.isArray(profile.adaptiveQuality) ? profile.adaptiveQuality : []).forEach((value) => {
    if (Number.isFinite(value) && !qualityValues.includes(value)) {
      qualityValues.push(value);
    }
  });

  if (!qualityValues.length) {
    qualityValues.push(null);
  }

  if (Number.isFinite(profile.qualityScale)) {
    scaleValues.push(profile.qualityScale);
  }

  (Array.isArray(profile.adaptiveScale) ? profile.adaptiveScale : []).forEach((value) => {
    if (Number.isFinite(value) && value > 0 && !scaleValues.includes(value)) {
      scaleValues.push(value);
    }
  });

  if (!scaleValues.length) {
    scaleValues.push(undefined);
  }

  return scaleValues.flatMap((qualityScale) =>
    qualityValues.map((quality) => ({
      format,
      quality,
      qualityScale
    }))
  );
}

export async function encodeFitpicExportCanvas(
  canvas,
  {
    format = "png",
    quality = null,
    fallbackFormat = "png",
    warningCollector = null
  } = {}
) {
  const requestedFormat = format === "webp" ? "webp" : "png";
  const requestedMimeType = requestedFormat === "webp" ? "image/webp" : "image/png";
  const fallbackMimeType = fallbackFormat === "webp" ? "image/webp" : "image/png";
  const warnings = Array.isArray(warningCollector) ? warningCollector : null;

  const createBlob = (mimeType, blobQuality) => new Promise((resolve) => canvas.toBlob(resolve, mimeType, blobQuality));
  let blob = await createBlob(requestedMimeType, quality ?? undefined);

  if (blob && blob.type === requestedMimeType) {
    return {
      blob,
      mimeType: requestedMimeType,
      format: requestedFormat,
      fallbackUsed: false
    };
  }

  if (requestedMimeType !== fallbackMimeType) {
    warnings?.push(`Canvas export fallback: ${requestedMimeType} unsupported, used ${fallbackMimeType}.`);
    blob = await createBlob(fallbackMimeType);

    if (blob) {
      return {
        blob,
        mimeType: fallbackMimeType,
        format: fallbackMimeType === "image/webp" ? "webp" : "png",
        fallbackUsed: true
      };
    }
  }

  const dataUrl = canvas.toDataURL(fallbackMimeType);
  const response = await fetch(dataUrl);
  const fallbackBlob = await response.blob();

  return {
    blob: fallbackBlob,
    mimeType: fallbackBlob.type || fallbackMimeType,
    format: fallbackBlob.type === "image/webp" ? "webp" : "png",
    fallbackUsed: requestedMimeType !== (fallbackBlob.type || fallbackMimeType)
  };
}

export async function renderFitpicImageExport({
  fitpics = [],
  options = createFitpicSpreadExportOptions("reference"),
  exportProfile = "png",
  exportProfileOverrides = {},
  resolveAssetUrl = (value) => value,
  fileName = `oa-fitpics-spread-${new Date().toISOString().slice(0, 10)}.png`
} = {}) {
  const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
  const orderedFitpics = getFitpicSpreadExportOrderedFitpics(fitpics, normalizedOptions);

  if (!orderedFitpics.length) {
    return null;
  }

  const profile = resolveFitpicImageExportProfile(exportProfile, exportProfileOverrides);
  const warnings = [];
  const encodingPlan = createFitpicExportEncodingPlan(profile);
  const detailOptions = {
    ...normalizedOptions,
    maxDetailImages: profile.maxDetailImages ?? normalizedOptions.maxDetailImages
  };
  const layoutMetrics = getFitpicSpreadExportLayoutMetrics(detailOptions);
  const eligibleFitpics = orderedFitpics.filter((fitpic) => fitpicHasSpreadExportImages(fitpic, detailOptions));
  const skippedFitpics = orderedFitpics.length - eligibleFitpics.length;

  if (!eligibleFitpics.length) {
    return null;
  }
  const imageSourcesToLoad = new Map();

  eligibleFitpics.forEach((fitpic) => {
    const cardImages = getFitpicSpreadExportCardImages(fitpic, detailOptions);
    const detailTiles = detailOptions.showDetailGrid
      ? getFitpicSpreadExportDetailTiles(fitpic, detailOptions.maxDetailImages, detailOptions)
      : [];

    cardImages.forEach((image) => {
      if (image?.src) {
        imageSourcesToLoad.set(image.src, resolveAssetUrl(image.src));
      }
    });

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
  let selectedEncoding = null;
  let selectedRenderConfig = null;

  for (const encoding of encodingPlan) {
    const renderConfig = getFitpicSpreadExportPackedRenderConfig(eligibleFitpics, detailOptions, {
      qualityScale: encoding.qualityScale
    });
    const {
      placements,
      canvasWidth,
      canvasHeight,
      exportScale,
      pixelWidth,
      pixelHeight
    } = renderConfig;
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
    context.fillStyle = colors.background;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    eligibleFitpics.forEach((fitpic, index) => {
      const placement = placements[index];

      if (!placement) {
        return;
      }

      const cardLeft = placement.x;
      const cardTop = placement.y;
      const exportCardHeight = placement.height;
      const cardWidth = placement.width;
      const cardInnerLeft = cardLeft + layoutMetrics.contentInset;
      const cardInnerWidth = cardWidth - layoutMetrics.contentInset * 2;
      let cursorY = cardTop + layoutMetrics.contentInset;
      const cardImages = getFitpicSpreadExportCardImages(fitpic, detailOptions);
      const heroImage = cardImages[0] ?? null;
      const heroImageLoaded = heroImage?.src ? loadedImages.get(heroImage.src) ?? null : null;
      const detailTiles = detailOptions.showDetailGrid
        ? getFitpicSpreadExportDetailTiles(fitpic, detailOptions.maxDetailImages, detailOptions)
        : [];
      const detailLayout = getFitpicSpreadExportDetailLayout(detailTiles.length, cardInnerWidth, {
        gap: layoutMetrics.detailGap,
        rowHeight: layoutMetrics.detailRowHeight,
        options: detailOptions
      });

      if (detailOptions.imageMode === "detailsOnly") {
        context.fillStyle = colors.background;
        context.fillRect(cardLeft, cardTop, cardWidth, exportCardHeight);
      } else {
        context.fillStyle = colors.panel;
        context.fillRect(cardLeft, cardTop, cardWidth, exportCardHeight);
        context.strokeStyle = colors.border;
        context.strokeRect(cardLeft + 0.5, cardTop + 0.5, cardWidth - 1, exportCardHeight - 1);
      }

      if (detailOptions.imageMode !== "detailsOnly") {
        context.fillStyle = colors.panelMuted;
        context.fillRect(cardInnerLeft, cursorY, cardInnerWidth, FITPIC_SPREAD_PRIMARY_HEIGHT);

        if (heroImageLoaded) {
          drawContainedImage(context, heroImageLoaded, cardInnerLeft, cursorY, cardInnerWidth, FITPIC_SPREAD_PRIMARY_HEIGHT);
        }

        cursorY += FITPIC_SPREAD_PRIMARY_HEIGHT + 10;
      }

      if (detailOptions.showTitle) {
        context.fillStyle = colors.text;
        context.font = detailOptions.imageMode === "detailsOnly"
          ? `600 14px ${fontFamily}`
          : `600 16px ${fontFamily}`;
        context.textAlign = "left";
        context.textBaseline = "top";

        const titleLines = getWrappedCanvasTextLines(
          context,
          fitpic.name || "Untitled fitpic",
          cardInnerWidth,
          layoutMetrics.titleMaxLines
        );
        titleLines.forEach((line, lineIndex) => {
          context.fillText(line, cardInnerLeft, cursorY + lineIndex * layoutMetrics.titleLineHeight, cardInnerWidth);
        });
        cursorY += layoutMetrics.titleBlockHeight;
      }

      if (detailOptions.showDetailGrid) {
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

        cursorY += detailLayout.totalHeight + (detailOptions.imageMode === "detailsOnly" ? 0 : 8);
      }

      if (detailOptions.showDescription) {
        context.fillStyle = colors.muted;
        context.font = `500 12px ${fontFamily}`;
        context.textAlign = "left";
        context.textBaseline = "top";
        const descriptionLines = getWrappedCanvasTextLines(context, fitpic.description || "No notes", cardInnerWidth, 2);
        descriptionLines.forEach((line, lineIndex) => {
          context.fillText(line, cardInnerLeft, cursorY + lineIndex * 16, cardInnerWidth);
        });
        cursorY += 36;
      }

      if (detailOptions.showTags) {
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

      if (detailOptions.showFitDate) {
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

    const encoded = encoding.format === "png"
      ? {
          blob: await canvasToBlob(canvas),
          mimeType: "image/png",
          format: "png",
          fallbackUsed: false
        }
      : await encodeFitpicExportCanvas(canvas, {
          format: encoding.format,
          quality: encoding.quality,
          fallbackFormat: "png",
          warningCollector: warnings
        });

    selectedEncoding = {
      ...encoding,
      ...encoded
    };
    selectedRenderConfig = renderConfig;

    if (!profile.targetBytes || encoded.blob.size <= profile.targetBytes) {
      break;
    }
  }

  const finalEncoding = selectedEncoding;

  if (!finalEncoding || !selectedRenderConfig) {
    return null;
  }

  const actualExtension = finalEncoding.format === "webp" ? "webp" : "png";
  const normalizedFileName = fileName.replace(/\.(png|webp)$/i, `.${actualExtension}`);
  const budgetExceeded = Number.isFinite(profile.targetBytes) && finalEncoding.blob.size > profile.targetBytes;
  const report = {
    fileName: normalizedFileName,
    format: finalEncoding.format,
    mimeType: finalEncoding.mimeType,
    sizeBytes: finalEncoding.blob.size,
    targetBytes: profile.targetBytes ?? null,
    budgetExceeded,
    quality: finalEncoding.quality ?? null,
    qualityScale: finalEncoding.qualityScale ?? null,
    exportScale: selectedRenderConfig.exportScale,
    maxDetailImages: detailOptions.maxDetailImages,
    pixelWidth: selectedRenderConfig.pixelWidth,
    pixelHeight: selectedRenderConfig.pixelHeight,
    warningCount: warnings.length,
    fallbackUsed: finalEncoding.fallbackUsed,
    fitpicCount: eligibleFitpics.length,
    skippedFitpicCount: skippedFitpics
  };

  if (typeof console !== "undefined" && console.info) {
    console.info(
      `[fitpic export] ${report.fileName}: ${(report.sizeBytes / (1024 * 1024)).toFixed(2)} MB (${report.mimeType}, scale ${report.qualityScale ?? "default"}, quality ${report.quality ?? "n/a"})`
    );
  }

  if (budgetExceeded && typeof console !== "undefined" && console.warn) {
    console.warn(
      `[fitpic export] ${report.fileName} exceeded target ${(report.targetBytes / (1024 * 1024)).toFixed(2)} MB with ${(report.sizeBytes / (1024 * 1024)).toFixed(2)} MB.`
    );
  }

  warnings.forEach((warning) => {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[fitpic export] ${warning}`);
    }
  });

  return {
    blob: finalEncoding.blob,
    fileName: normalizedFileName,
    mimeType: finalEncoding.mimeType,
    report,
    warnings
  };
}

export async function downloadFitpicImageExport(config = {}) {
  const result = await renderFitpicImageExport(config);

  if (!result) {
    return null;
  }

  downloadExportFile(await result.blob.arrayBuffer(), {
    filename: result.fileName,
    mimeType: result.mimeType || "image/png"
  });

  return result;
}
