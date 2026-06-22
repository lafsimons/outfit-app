import { downloadExportFile } from "./metadataExport.js";
import { getManagedImageDrawBox, getManagedImageSourceRect } from "./imagePresentation.js";
import {
  WARDROBE_SPREAD_CELL_SIZE,
  WARDROBE_SPREAD_HIGH_QUALITY_SCALE,
  WARDROBE_SPREAD_LABEL_FONT_SIZE,
  WARDROBE_SPREAD_LABEL_GAP,
  WARDROBE_SPREAD_LABEL_LINE_HEIGHT,
  WARDROBE_SPREAD_LABEL_SIDE_PADDING,
  WARDROBE_SPREAD_LABEL_TOP_GAP,
  getWardrobeSpreadExportImageSource,
  getWardrobeSpreadExportLabelRowCount,
  getWardrobeSpreadExportLabelRows,
  getWardrobeSpreadExportOrderedItems,
  getWardrobeSpreadExportRenderConfig,
  normalizeWardrobeSpreadExportOptions
} from "./wardrobeSpreadExport.js";

export const WARDROBE_IMAGE_EXPORT_TARGET_BYTES = 30 * 1024 * 1024;

export const wardrobeImageExportProfiles = {
  png: {
    format: "png",
    quality: null,
    qualityScale: null,
    adaptiveQuality: [],
    adaptiveScale: [],
    targetBytes: null
  },
  ai: {
    format: "webp",
    quality: 0.96,
    qualityScale: 6,
    adaptiveQuality: [0.94, 0.9],
    adaptiveScale: [5.5, 5, 4.5, 4, WARDROBE_SPREAD_HIGH_QUALITY_SCALE],
    targetBytes: WARDROBE_IMAGE_EXPORT_TARGET_BYTES
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

function getWrappedCanvasTextLines(context, text, maxWidth) {
  const normalizedText = String(text || "").trim().replace(/\s+/g, " ");

  if (!normalizedText) {
    return [];
  }

  const words = normalizedText.split(" ");
  const lines = [];
  let currentLine = "";

  function splitLongWord(word) {
    if (context.measureText(word).width <= maxWidth) {
      return [word];
    }

    const segments = [];
    let currentSegment = "";

    [...word].forEach((character) => {
      const nextSegment = `${currentSegment}${character}`;

      if (!currentSegment || context.measureText(nextSegment).width <= maxWidth) {
        currentSegment = nextSegment;
        return;
      }

      segments.push(currentSegment);
      currentSegment = character;
    });

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  }

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (!currentLine || context.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    const wrappedWordSegments = splitLongWord(word);
    currentLine = wrappedWordSegments.shift() || "";
    lines.push(...wrappedWordSegments);
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function getItemLabelLines(context, item, options, textWidth) {
  const labelRows = getWardrobeSpreadExportLabelRows(item, options);

  return labelRows.flatMap(({ key, text }) =>
    getWrappedCanvasTextLines(context, text, textWidth).map((line) => ({
      key,
      text: line
    }))
  );
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

function drawMissingImagePlaceholder(context, frameX, frameY, frameWidth, frameHeight, {
  backgroundColor = "#ece7df",
  borderColor = "rgba(17, 17, 17, 0.18)",
  textColor = "rgba(17, 17, 17, 0.72)",
  fontFamily = "monospace"
} = {}) {
  context.save();
  context.fillStyle = backgroundColor;
  context.fillRect(frameX, frameY, frameWidth, frameHeight);
  context.strokeStyle = borderColor;
  context.lineWidth = 1;
  context.strokeRect(frameX + 0.5, frameY + 0.5, frameWidth - 1, frameHeight - 1);
  context.fillStyle = textColor;
  context.font = `600 12px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Missing image", frameX + frameWidth / 2, frameY + frameHeight / 2, Math.max(0, frameWidth - 16));
  context.restore();
}

function createMissingImageWarning(item = {}, { fileName = "", sourceType = "missing", detail = "" } = {}) {
  return {
    type: "missing_export_image",
    reason: "missing export image",
    detail,
    fileName,
    sourceType,
    itemId: item?.id ?? "",
    itemUuid: item?.itemUuid ?? "",
    brand: item?.brand ?? "",
    name: item?.name ?? "",
    status: item?.status ?? item?.list ?? "",
    collections: Array.isArray(item?.collections) ? item.collections : []
  };
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

function resolveWardrobeImageExportProfile(profile = "png", overrides = {}) {
  const resolvedProfile = typeof profile === "string"
    ? wardrobeImageExportProfiles[profile] ?? wardrobeImageExportProfiles.png
    : wardrobeImageExportProfiles.png;

  return {
    ...resolvedProfile,
    ...(overrides && typeof overrides === "object" ? overrides : {})
  };
}

function createWardrobeExportEncodingPlan(profile = {}) {
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

export async function encodeWardrobeExportCanvas(
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

export async function renderWardrobeImageExport({
  items = [],
  options = {},
  exportProfile = "png",
  exportProfileOverrides = {},
  resolveAssetUrl = (value) => value,
  fileName = `oa-wardrobe-export-${new Date().toISOString().slice(0, 10)}.png`,
  random = Math.random
} = {}) {
  const normalizedOptions = normalizeWardrobeSpreadExportOptions(options);
  const exportItems = getWardrobeSpreadExportOrderedItems(items, normalizedOptions, random);
  const profile = resolveWardrobeImageExportProfile(exportProfile, exportProfileOverrides);
  const warnings = [];

  if (!exportItems.length) {
    return null;
  }

  const documentStyles = getDocumentStyles();
  const exportBackgroundColor = documentStyles?.getPropertyValue("--bg").trim() || "#f7f7f7";
  const exportTextColor = documentStyles?.getPropertyValue("--text").trim() || "#111";
  const exportMutedTextColor = documentStyles?.getPropertyValue("--muted-strong").trim() || "rgba(17, 17, 17, 0.75)";
  const exportFontFamily = documentStyles?.getPropertyValue("font-family").trim() || "monospace";
  const labelTextWidth = WARDROBE_SPREAD_CELL_SIZE - WARDROBE_SPREAD_LABEL_SIDE_PADDING * 2;
  const measurementCanvas = document.createElement("canvas");
  const measurementContext = measurementCanvas.getContext("2d");

  if (!measurementContext) {
    throw new Error("The wardrobe image could not be exported.");
  }

  measurementContext.font = `500 ${WARDROBE_SPREAD_LABEL_FONT_SIZE}px ${exportFontFamily}`;

  const itemLabelLines = exportItems.map((item) =>
    getItemLabelLines(measurementContext, item, normalizedOptions, labelTextWidth)
  );
  const labelRowCount = itemLabelLines.length
    ? Math.max(...itemLabelLines.map((lines) => lines.length))
    : getWardrobeSpreadExportLabelRowCount(normalizedOptions);
  const sourceTypeCounts = {};
  const missingImageWarnings = [];
  const preparedItems = await Promise.all(
    exportItems.map(async (item) => {
      const source = getWardrobeSpreadExportImageSource(item);
      const exportImageUrl = resolveAssetUrl(source.src);

      sourceTypeCounts[source.sourceType] = (sourceTypeCounts[source.sourceType] ?? 0) + 1;

      if (!exportImageUrl) {
        const warning = createMissingImageWarning(item, {
          fileName,
          sourceType: source.sourceType,
          detail: "No exportable image source was available for this item."
        });
        warnings.push(`${warning.itemId || warning.itemUuid || warning.name || "item"}: missing export image`);
        missingImageWarnings.push(warning);

        return {
          item,
          image: null,
          sourceType: source.sourceType,
          missingImage: true
        };
      }

      try {
        const image = await loadImage(exportImageUrl);

        return {
          item,
          image,
          sourceType: source.sourceType,
          missingImage: false
        };
      } catch (error) {
        const warning = createMissingImageWarning(item, {
          fileName,
          sourceType: source.sourceType,
          detail: error?.message ?? "Image could not be loaded."
        });
        warnings.push(`${warning.itemId || warning.itemUuid || warning.name || "item"}: missing export image`);
        missingImageWarnings.push(warning);

        return {
          item,
          image: null,
          sourceType: source.sourceType,
          missingImage: true
        };
      }
    })
  );

  const encodingPlan = createWardrobeExportEncodingPlan(profile);
  let selectedEncoding = null;
  let selectedRenderConfig = null;

  for (const encoding of encodingPlan) {
    const renderConfig = getWardrobeSpreadExportRenderConfig(exportItems.length, {
      labelRowCount,
      qualityScale: encoding.qualityScale
    });

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
    } = renderConfig;
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

    context.fillStyle = exportBackgroundColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    preparedItems.forEach(({ item, image, missingImage }, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cellLeft = padding + column * cellSize;
      const cellTop = padding + row * cellHeight;
      const maxImageSize = cellSize * 0.82;
      const fallbackFrameWidth = cellSize * 0.68;
      const fallbackFrameHeight = cellSize * 0.68;
      const sourceRect = image ? getManagedImageSourceRect(item, image.naturalWidth, image.naturalHeight) : null;
      const baseScale = sourceRect
        ? Math.min(maxImageSize / sourceRect.width, maxImageSize / sourceRect.height, 1)
        : 1;
      const frameWidth = sourceRect ? sourceRect.width * baseScale : fallbackFrameWidth;
      const frameHeight = sourceRect ? sourceRect.height * baseScale : fallbackFrameHeight;
      const jitterX = normalizedOptions.shuffleItems ? (random() - 0.5) * cellSize * 0.22 : 0;
      const jitterY = normalizedOptions.shuffleItems ? (random() - 0.5) * cellSize * 0.22 : 0;
      const frameX = cellLeft + (cellSize - frameWidth) / 2 + jitterX;
      const frameY = cellTop + (cellSize - frameHeight) / 2 + jitterY;
      const labelLines = itemLabelLines[index] ?? [];

      if (missingImage || !image) {
        drawMissingImagePlaceholder(context, frameX, frameY, frameWidth, frameHeight, {
          backgroundColor: exportBackgroundColor,
          borderColor: exportMutedTextColor,
          textColor: exportMutedTextColor,
          fontFamily: exportFontFamily
        });
      } else {
        drawManagedImageToCanvas(context, item, image, frameX, frameY, frameWidth, frameHeight);
      }

      if (!labelLines.length) {
        return;
      }

      context.textAlign = "center";
      context.textBaseline = "top";
      context.font = `500 ${WARDROBE_SPREAD_LABEL_FONT_SIZE}px ${exportFontFamily}`;

      labelLines.forEach(({ key, text }, labelIndex) => {
        if (!text) {
          return;
        }

        const textY = cellTop
          + cellSize
          + WARDROBE_SPREAD_LABEL_TOP_GAP
          + labelIndex * (WARDROBE_SPREAD_LABEL_LINE_HEIGHT + WARDROBE_SPREAD_LABEL_GAP);
        const textWidth = cellSize - WARDROBE_SPREAD_LABEL_SIDE_PADDING * 2;

        context.fillStyle = key === "name" ? exportTextColor : exportMutedTextColor;
        context.fillText(text, cellLeft + cellSize / 2, textY, textWidth);
      });
    });

    const encoded = encoding.format === "png"
      ? {
          blob: await canvasToBlob(canvas),
          mimeType: "image/png",
          format: "png",
          fallbackUsed: false
        }
      : await encodeWardrobeExportCanvas(canvas, {
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
  const sortedSourceTypeCounts = Object.fromEntries(
    Object.entries(sourceTypeCounts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  );
  const report = {
    fileName: normalizedFileName,
    itemCount: exportItems.length,
    format: finalEncoding.format,
    mimeType: finalEncoding.mimeType,
    sizeBytes: finalEncoding.blob.size,
    targetBytes: profile.targetBytes ?? null,
    budgetExceeded: Number.isFinite(profile.targetBytes) && finalEncoding.blob.size > profile.targetBytes,
    quality: finalEncoding.quality ?? null,
    qualityScale: finalEncoding.qualityScale ?? null,
    exportScale: selectedRenderConfig.exportScale,
    pixelWidth: selectedRenderConfig.pixelWidth,
    pixelHeight: selectedRenderConfig.pixelHeight,
    warningCount: warnings.length,
    missingImageCount: missingImageWarnings.length,
    warnings: missingImageWarnings,
    fallbackUsed: finalEncoding.fallbackUsed,
    sourceType: Object.keys(sortedSourceTypeCounts)[0] ?? "missing",
    sourceTypeCounts: sortedSourceTypeCounts
  };

  if (typeof console !== "undefined" && console.info) {
    console.info(
      `[wardrobe export] ${report.fileName}: ${(report.sizeBytes / (1024 * 1024)).toFixed(2)} MB (${report.mimeType}, ${report.pixelWidth}x${report.pixelHeight}, scale ${report.qualityScale ?? "default"}, quality ${report.quality ?? "n/a"}, fallback ${report.fallbackUsed ? "yes" : "no"})`
    );
  }

  if (report.budgetExceeded && typeof console !== "undefined" && console.warn) {
    console.warn(
      `[wardrobe export] ${report.fileName} exceeded target ${(report.targetBytes / (1024 * 1024)).toFixed(2)} MB with ${(report.sizeBytes / (1024 * 1024)).toFixed(2)} MB.`
    );
  }

  return {
    blob: finalEncoding.blob,
    fileName: normalizedFileName,
    mimeType: finalEncoding.mimeType,
    report,
    warnings
  };
}

export async function downloadWardrobeImageExport(config = {}) {
  const result = await renderWardrobeImageExport(config);

  if (!result) {
    return null;
  }

  downloadExportFile(await result.blob.arrayBuffer(), {
    filename: result.fileName,
    mimeType: result.mimeType || "image/png"
  });

  return result;
}
