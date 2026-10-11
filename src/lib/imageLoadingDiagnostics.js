// Opt-in, session-only evidence collection. Never includes image bytes or sends data.
const MAX_EVENTS = 400;
let enabled = false;
let startedAt = null;
let events = [];

export function isImageTraceEnabled() {
  return enabled;
}

export function startImageTrace() {
  events = [];
  startedAt = new Date().toISOString();
  enabled = true;
  recordImageTrace("trace-start");
}

export function stopImageTrace() {
  recordImageTrace("trace-stop");
  enabled = false;
}

export function describeImageSource(src = "") {
  if (src.startsWith("data:")) return { kind: "data", length: src.length };
  if (src.startsWith("blob:")) return { kind: "blob" };
  // Only include the filename, not signed URL credentials, queries or local paths.
  const path = src.split(/[?#]/)[0];
  return { kind: /^https?:/.test(src) ? "remote" : "local", filename: path.split("/").pop() || "" };
}

export function recordImageTrace(type, details = {}) {
  if (!enabled) return;
  events.push({ time: new Date().toISOString(), type, ...details });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

function rectOf(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return Object.fromEntries(["x", "y", "width", "height"].map(key => [key, Math.round(rect[key] * 100) / 100]));
}

function describeElement(element) {
  if (!element) return null;
  const style = getComputedStyle(element);
  return {
    tag: element.tagName,
    className: typeof element.className === "string" ? element.className : "",
    rect: rectOf(element),
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    overflow: style.overflow,
    contain: style.contain,
    contentVisibility: style.contentVisibility,
    transform: style.transform,
    clipPath: style.clipPath
  };
}

export function captureOutfitImageSnapshot(reason, root = document) {
  if (!enabled) return;
  const slots = [...root.querySelectorAll(".outfit-slot")].map(slot => {
    const frame = slot.querySelector(".managed-image");
    const image = slot.querySelector("img");
    const ancestors = [];
    let ancestor = slot;
    for (let index = 0; ancestor && index < 6; index += 1, ancestor = ancestor.parentElement) {
      ancestors.push(describeElement(ancestor));
    }
    return {
      slot: slot.className,
      itemId: frame?.dataset.itemId || "",
      placeholder: Boolean(frame?.classList.contains("managed-image-empty")),
      frame: describeElement(frame),
      figure: describeElement(slot.querySelector(".item-figure")),
      image: image ? {
        ...describeElement(image),
        source: describeImageSource(image.currentSrc || image.src),
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        loading: image.loading,
        decoding: image.decoding
      } : null,
      ancestors
    };
  });
  recordImageTrace("snapshot", { reason, slots });
}

export function getImageTraceReport() {
  return {
    version: 1,
    startedAt,
    exportedAt: new Date().toISOString(),
    enabled,
    environment: typeof window === "undefined" ? null : {
      userAgent: navigator.userAgent,
      origin: window.location.origin,
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      visibility: document.visibilityState
    },
    events: [...events]
  };
}
