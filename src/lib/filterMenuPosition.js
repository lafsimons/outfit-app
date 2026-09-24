export function getFilterMenuPosition(anchor, viewport) {
  const margin = 8;
  const gap = 4;
  const leftEdge = (viewport.left ?? 0) + margin;
  const topEdge = (viewport.top ?? 0) + margin;
  const rightEdge = (viewport.left ?? 0) + viewport.width - margin;
  const bottomEdge = (viewport.top ?? 0) + viewport.height - margin;
  const width = Math.max(0, Math.min(280, rightEdge - leftEdge));
  const below = Math.max(0, bottomEdge - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - topEdge - gap);
  const upward = below < 300 && above > below;
  const maxHeight = Math.min(300, upward ? above : below);
  return {
    width,
    maxHeight,
    left: Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)),
    top: upward ? Math.min(bottomEdge, anchor.top - gap) : Math.max(topEdge, anchor.bottom + gap),
    transform: upward ? "translateY(-100%)" : "none"
  };
}
