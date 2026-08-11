export function getImageFilename(imageUrl) {
  const pathname = imageUrl.split("?")[0].split("#")[0];
  const filename = pathname.split("/").pop() ?? "";

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

export function buildManagedImageMetricsCacheKey({
  resolvedImageUrl = "",
  assetUuid = "",
  itemImageUuid = "",
  itemUuid = "",
  itemId = ""
} = {}) {
  const normalizedUrl = typeof resolvedImageUrl === "string" ? resolvedImageUrl.trim() : "";

  if (!normalizedUrl) {
    return assetUuid || itemImageUuid || itemUuid || itemId || "";
  }

  if (normalizedUrl.startsWith("data:image/")) {
    return assetUuid || itemImageUuid || itemUuid || itemId || `data-url:${normalizedUrl.length}`;
  }

  return assetUuid || normalizedUrl;
}

export function stripViteHash(filename) {
  const extensionIndex = filename.lastIndexOf(".");

  if (extensionIndex === -1) {
    return filename;
  }

  const stem = filename.slice(0, extensionIndex);
  const extension = filename.slice(extensionIndex);
  const hashSeparatorIndex = stem.lastIndexOf("-");

  if (hashSeparatorIndex === -1) {
    return filename;
  }

  return `${stem.slice(0, hashSeparatorIndex)}${extension}`;
}

export function normalizeImageScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return Math.min(180, Math.max(50, Math.round(parsed)));
}

export function normalizeImageFrameScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return Math.min(300, Math.max(20, Math.round(parsed)));
}

export function normalizeImageOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(50, Math.max(-50, Math.round(parsed)));
}

export function normalizeImageCropSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.min(100, Math.max(1, Math.round(parsed)));
}

export function normalizeImageCropStart(value, size) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100 - size, Math.max(0, Math.round(parsed)));
}

export function getNormalizedImageCrop(item) {
  const width = normalizeImageCropSize(item?.imageCropWidth);
  const height = normalizeImageCropSize(item?.imageCropHeight);
  const x = normalizeImageCropStart(item?.imageCropX, width);
  const y = normalizeImageCropStart(item?.imageCropY, height);

  return { x, y, width, height };
}

export function itemNeedsImageBake(item) {
  const imageUrl = item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "";

  return Boolean(imageUrl) && (
    normalizeImageScale(item?.imageScale) !== normalizeImageFrameScale(item?.imageFrameScale) ||
    normalizeImageOffset(item?.imageOffsetX) !== 0 ||
    normalizeImageOffset(item?.imageOffsetY) !== 0
  );
}

export function getVisibleAlphaBounds(imageData, width, height, alphaThreshold = 16) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = imageData[(y * width + x) * 4 + 3];
      if (alpha < alphaThreshold) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    left: minX,
    top: minY,
    right: maxX + 1,
    bottom: maxY + 1
  };
}

function getPixelOffset(width, x, y) {
  return (y * width + x) * 4;
}

function getPixelRgba(imageData, width, x, y) {
  const offset = getPixelOffset(width, x, y);
  return {
    r: imageData[offset],
    g: imageData[offset + 1],
    b: imageData[offset + 2],
    a: imageData[offset + 3]
  };
}

function getCornerBackgroundReference(imageData, width, height, alphaThreshold, colorSpreadThreshold) {
  const corners = [
    getPixelRgba(imageData, width, 0, 0),
    getPixelRgba(imageData, width, Math.max(0, width - 1), 0),
    getPixelRgba(imageData, width, 0, Math.max(0, height - 1)),
    getPixelRgba(imageData, width, Math.max(0, width - 1), Math.max(0, height - 1))
  ].filter((pixel) => pixel.a >= alphaThreshold);

  if (corners.length < 3) {
    return null;
  }

  const channels = ["r", "g", "b"];
  const maxSpread = Math.max(
    ...channels.map((channel) => Math.max(...corners.map((pixel) => pixel[channel])) - Math.min(...corners.map((pixel) => pixel[channel])))
  );

  if (maxSpread > colorSpreadThreshold) {
    return null;
  }

  const sum = corners.reduce((accumulator, pixel) => ({
    r: accumulator.r + pixel.r,
    g: accumulator.g + pixel.g,
    b: accumulator.b + pixel.b,
    a: accumulator.a + pixel.a
  }), { r: 0, g: 0, b: 0, a: 0 });

  return {
    r: sum.r / corners.length,
    g: sum.g / corners.length,
    b: sum.b / corners.length,
    a: sum.a / corners.length
  };
}

function isBackgroundLikePixel(pixel, backgroundReference, alphaThreshold, colorThreshold, alphaDistanceThreshold) {
  if (pixel.a < alphaThreshold) {
    return true;
  }

  if (!backgroundReference) {
    return false;
  }

  const colorDistance = Math.max(
    Math.abs(pixel.r - backgroundReference.r),
    Math.abs(pixel.g - backgroundReference.g),
    Math.abs(pixel.b - backgroundReference.b)
  );
  const alphaDistance = Math.abs(pixel.a - backgroundReference.a);

  return colorDistance <= colorThreshold && alphaDistance <= alphaDistanceThreshold;
}

export function getVisibleContentBounds(
  imageData,
  width,
  height,
  {
    alphaThreshold = 16,
    colorThreshold = 26,
    colorSpreadThreshold = 32,
    alphaDistanceThreshold = 32
  } = {}
) {
  const alphaBounds = getVisibleAlphaBounds(imageData, width, height, alphaThreshold);

  if (!alphaBounds) {
    return null;
  }

  const backgroundReference = getCornerBackgroundReference(
    imageData,
    width,
    height,
    alphaThreshold,
    colorSpreadThreshold
  );

  if (!backgroundReference) {
    return alphaBounds;
  }

  const visited = new Uint8Array(width * height);
  const queue = [];
  let queueIndex = 0;

  function enqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }

    const pixel = getPixelRgba(imageData, width, x, y);
    if (!isBackgroundLikePixel(pixel, backgroundReference, alphaThreshold, colorThreshold, alphaDistanceThreshold)) {
      return;
    }

    visited[pixelIndex] = 1;
    queue.push({ x, y });
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queueIndex < queue.length) {
    const { x, y } = queue[queueIndex];
    queueIndex += 1;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) {
        continue;
      }

      const pixel = getPixelRgba(imageData, width, x, y);
      if (pixel.a < alphaThreshold) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return alphaBounds;
  }

  return {
    left: minX,
    top: minY,
    right: maxX + 1,
    bottom: maxY + 1
  };
}

export function getItemImageStyle(item, { useFrameScale = false, normalizeToFrameScale = false, usePresentation = false } = {}) {
  const frameScale = useFrameScale && usePresentation ? normalizeImageFrameScale(item?.imageFrameScale) : 100;
  const transformFrameScale = normalizeToFrameScale && usePresentation ? normalizeImageFrameScale(item?.imageFrameScale) : 100;
  const scale = usePresentation ? normalizeImageScale(item?.imageScale) : 100;
  const offsetX = usePresentation ? normalizeImageOffset(item?.imageOffsetX) : 0;
  const offsetY = usePresentation ? normalizeImageOffset(item?.imageOffsetY) : 0;
  const effectiveScale = scale / transformFrameScale;

  return {
    "--managed-frame-scale": frameScale / 100,
    "--managed-scale": effectiveScale,
    "--managed-offset-x": `${offsetX}%`,
    "--managed-offset-y": `${offsetY}%`
  };
}

export function getManagedImageSourceRect(item, naturalWidth, naturalHeight, { useCrop = false } = {}) {
  const crop = useCrop ? getNormalizedImageCrop(item) : { x: 0, y: 0, width: 100, height: 100 };
  const sourceX = (crop.x / 100) * naturalWidth;
  const sourceY = (crop.y / 100) * naturalHeight;
  const sourceWidth = (crop.width / 100) * naturalWidth;
  const sourceHeight = (crop.height / 100) * naturalHeight;

  return {
    x: sourceX,
    y: sourceY,
    width: Math.max(sourceWidth, 1),
    height: Math.max(sourceHeight, 1)
  };
}

export function getManagedImageFrameStyle(item, metrics, options = {}) {
  const crop = options.useCrop && options.usePresentation ? getNormalizedImageCrop(item) : { x: 0, y: 0, width: 100, height: 100 };
  const cropWidth = crop.width / 100;
  const cropHeight = crop.height / 100;
  const naturalWidth = Math.max(metrics?.naturalWidth ?? 1, 1);
  const naturalHeight = Math.max(metrics?.naturalHeight ?? 1, 1);
  const cropAspectRatio = (naturalWidth * cropWidth) / (naturalHeight * cropHeight);

  return {
    aspectRatio: `${cropAspectRatio || 1}`,
    "--managed-crop-aspect": `${cropAspectRatio || 1}`,
    "--managed-base-width": `${100 / cropWidth}%`,
    "--managed-base-height": `${100 / cropHeight}%`,
    "--managed-base-left": `${(-crop.x / crop.width) * 100}%`,
    "--managed-base-top": `${(-crop.y / crop.height) * 100}%`,
    ...getItemImageStyle(item, options)
  };
}

export function getManagedImageDrawBox(item, image, frameX, frameY, frameWidth, frameHeight, { useFrameScale = false, useCrop = false, usePresentation = false } = {}) {
  const crop = useCrop && usePresentation ? getNormalizedImageCrop(item) : { x: 0, y: 0, width: 100, height: 100 };
  const scale = (usePresentation ? normalizeImageScale(item?.imageScale) : 100) / (usePresentation ? normalizeImageFrameScale(item?.imageFrameScale) : 100);
  const sourceRect = getManagedImageSourceRect(item, image.naturalWidth, image.naturalHeight, { useCrop: useCrop && usePresentation });
  const drawCropWidth = image.naturalWidth * (crop.width / 100);
  const drawCropHeight = image.naturalHeight * (crop.height / 100);
  const cropScale = Math.min(frameWidth / drawCropWidth, frameHeight / drawCropHeight, 1_000);
  const visibleWidth = drawCropWidth * cropScale;
  const visibleHeight = drawCropHeight * cropScale;
  const baseWidth = visibleWidth / (crop.width / 100);
  const baseHeight = visibleHeight / (crop.height / 100);
  const baseX = frameX - (crop.x / 100) * baseWidth;
  const baseY = frameY - (crop.y / 100) * baseHeight;
  const scaledWidth = baseWidth * scale;
  const scaledHeight = baseHeight * scale;
  const offsetX = ((usePresentation ? normalizeImageOffset(item?.imageOffsetX) : 0) / 100) * scaledWidth;
  const offsetY = ((usePresentation ? normalizeImageOffset(item?.imageOffsetY) : 0) / 100) * scaledHeight;

  return {
    sourceRect,
    drawX: baseX + offsetX - (scaledWidth - baseWidth) / 2,
    drawY: baseY + offsetY - (scaledHeight - baseHeight) / 2,
    drawWidth: scaledWidth,
    drawHeight: scaledHeight
  };
}
