export const IMPORT_LITERAL_ORIGINAL_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_LITERAL_ORIGINAL_MAX_LONG_EDGE = 4000;
export const IMPORT_ARCHIVAL_MAX_LONG_EDGE = 4000;
export const IMPORT_ARCHIVAL_WEBP_QUALITY = 0.95;
export const IMPORT_DISPLAY_MAX_LONG_EDGE = 1600;
export const IMPORT_DISPLAY_WEBP_QUALITY = 0.9;
export const IMPORT_THUMBNAIL_MAX_LONG_EDGE = 320;
export const IMPORT_THUMBNAIL_WEBP_QUALITY = 0.72;

function normalizePositiveNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function getMimeTypeFromDataUrl(dataUrl = "") {
  const match = typeof dataUrl === "string" ? dataUrl.match(/^data:([^;,]+)/i) : null;
  return match?.[1] ?? "";
}

function getVariantScale(width, height, maxLongEdge) {
  const longEdge = Math.max(width, height);

  if (!longEdge || !Number.isFinite(maxLongEdge) || maxLongEdge <= 0) {
    return 1;
  }

  return Math.min(1, maxLongEdge / longEdge);
}

function createCanvasElement() {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    throw new Error("Image processing is unavailable outside the browser.");
  }

  return document.createElement("canvas");
}

function canvasToDataUrl(canvas, type, quality) {
  const dataUrl = canvas.toDataURL(type, quality);
  return dataUrl.startsWith(`data:${type}`) ? dataUrl : "";
}

async function defaultDataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function renderImageVariant(
  image,
  {
    maxLongEdge,
    quality,
    createCanvas = createCanvasElement,
    dataUrlToBlob = defaultDataUrlToBlob
  } = {}
) {
  const naturalWidth = normalizePositiveNumber(image?.naturalWidth);
  const naturalHeight = normalizePositiveNumber(image?.naturalHeight);
  const scale = getVariantScale(naturalWidth, naturalHeight, maxLongEdge);
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = createCanvas();
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image could not be processed.");
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const dataUrl = canvasToDataUrl(canvas, "image/webp", quality) || canvas.toDataURL("image/png");
  const blob = await dataUrlToBlob(dataUrl);

  return {
    src: dataUrl,
    mimeType: blob.type || getMimeTypeFromDataUrl(dataUrl),
    fileSize: normalizePositiveNumber(blob.size),
    width,
    height
  };
}

export async function buildImageVariantFromSource(
  source,
  {
    maxLongEdge,
    quality,
    loadImage,
    createCanvas = createCanvasElement,
    dataUrlToBlob = defaultDataUrlToBlob
  } = {}
) {
  if (typeof loadImage !== "function") {
    throw new Error("Image loading helper is required.");
  }

  const sourceValue = typeof source === "string" ? source.trim() : "";

  if (!sourceValue) {
    throw new Error("A source image is required.");
  }

  const image = await loadImage(sourceValue);
  return renderImageVariant(image, {
    maxLongEdge,
    quality,
    createCanvas,
    dataUrlToBlob
  });
}

export async function buildThumbnailVariantFromSource(
  source,
  {
    loadImage,
    createCanvas = createCanvasElement,
    dataUrlToBlob = defaultDataUrlToBlob
  } = {}
) {
  return buildImageVariantFromSource(source, {
    maxLongEdge: IMPORT_THUMBNAIL_MAX_LONG_EDGE,
    quality: IMPORT_THUMBNAIL_WEBP_QUALITY,
    loadImage,
    createCanvas,
    dataUrlToBlob
  });
}

export function shouldPreserveLiteralImportedOriginal({
  sourceFileSize = 0,
  sourceImageWidth = 0,
  sourceImageHeight = 0
} = {}) {
  return (
    normalizePositiveNumber(sourceFileSize) <= IMPORT_LITERAL_ORIGINAL_MAX_BYTES
    && Math.max(
      normalizePositiveNumber(sourceImageWidth),
      normalizePositiveNumber(sourceImageHeight)
    ) <= IMPORT_LITERAL_ORIGINAL_MAX_LONG_EDGE
  );
}

export async function buildImportedImageAssetSet(
  source,
  {
    readFileAsDataUrl,
    loadImage,
    createCanvas = createCanvasElement,
    dataUrlToBlob = defaultDataUrlToBlob
  } = {}
) {
  if (!source?.type?.startsWith?.("image/")) {
    throw new Error("Selected file is not an image.");
  }

  if (typeof readFileAsDataUrl !== "function" || typeof loadImage !== "function") {
    throw new Error("Image import helpers are required.");
  }

  const sourceDataUrl = await readFileAsDataUrl(source);
  const image = await loadImage(sourceDataUrl);
  const sourceImageWidth = normalizePositiveNumber(image?.naturalWidth);
  const sourceImageHeight = normalizePositiveNumber(image?.naturalHeight);
  const sourceFileSize = normalizePositiveNumber(source?.size);
  const sourceMimeType = source?.type || getMimeTypeFromDataUrl(sourceDataUrl);
  const originalPreserved = shouldPreserveLiteralImportedOriginal({
    sourceFileSize,
    sourceImageWidth,
    sourceImageHeight
  });
  const original = originalPreserved
    ? {
        src: sourceDataUrl,
        mimeType: sourceMimeType,
        fileSize: sourceFileSize,
        width: sourceImageWidth,
        height: sourceImageHeight
      }
    : await renderImageVariant(image, {
        maxLongEdge: IMPORT_ARCHIVAL_MAX_LONG_EDGE,
        quality: IMPORT_ARCHIVAL_WEBP_QUALITY,
        createCanvas,
        dataUrlToBlob
      });
  const display = await renderImageVariant(image, {
    maxLongEdge: IMPORT_DISPLAY_MAX_LONG_EDGE,
    quality: IMPORT_DISPLAY_WEBP_QUALITY,
    createCanvas,
    dataUrlToBlob
  });
  const thumbnail = await renderImageVariant(image, {
    maxLongEdge: IMPORT_THUMBNAIL_MAX_LONG_EDGE,
    quality: IMPORT_THUMBNAIL_WEBP_QUALITY,
    createCanvas,
    dataUrlToBlob
  });

  return {
    sourceDataUrl,
    sourceMimeType,
    sourceFileSize,
    sourceImageWidth,
    sourceImageHeight,
    originalPreserved,
    archivalOriginalPreserved: !originalPreserved,
    original,
    display,
    thumbnail
  };
}
