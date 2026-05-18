export function getImageFilename(imageUrl) {
  const pathname = imageUrl.split("?")[0].split("#")[0];
  const filename = pathname.split("/").pop() ?? "";

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
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
