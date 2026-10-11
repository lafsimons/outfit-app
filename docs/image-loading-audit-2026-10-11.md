# Image loading audit — 11 October 2026

The intermittent missing-pants symptom has not been reproduced in the test browser. The previous eager-loading/paint-containment change did not establish the root cause. This audit adds opt-in evidence collection, without another speculative change to loading behavior.

## Verified loading sequence

1. `ManagedItemPresentationImage` resolves a display image URL and looks for cached natural dimensions.
2. A generation slot without dimensions renders an intentionally invisible `.managed-image-empty` placeholder. The actual board `<img>` is not mounted yet.
3. `loadImageMetrics` creates a separate `new Image()`. Concurrent callers share pending promises by asset/cache key or URL.
4. After `onload`, the loader waits for `decode()` to settle. Only then does it cache dimensions and resolve the promise.
5. React marks the target ready, calculates the crop/frame, and mounts a second image element in the board. Board images now use eager loading; decoding remains asynchronous.
6. Frame dimensions depend on cached natural dimensions, crop, scale, per-slot CSS, and ancestor clipping. Hover also changes controls and may cause repaint or React updates.

## Confirmed observability and robustness gaps

- Preload errors resolve as `{naturalWidth: 1, naturalHeight: 1}` and are cached as if successful. There is no distinct error result or automatic retry in that loader.
- A load or decode promise has no timeout. A stalled promise can keep the invisible placeholder mounted. This is a possible failure path, not evidence that it caused this incident.
- Existing performance `imageReady` is recorded when React selects the target URL; its `paint` measurement is a requestAnimationFrame callback. Neither confirms that the actual board image loaded, decoded, or became visibly painted.
- Before this instrumentation, the presented board image had no load/error evidence captured. A successful off-DOM preload and a successful visible board render could not be distinguished.
- Caches are mutable Maps. Hover can coincide with a rerender or a repaint, so the symptom alone cannot determine whether React state, cache readiness, geometry, or browser painting is responsible.
- Source identity can use asset/item identifiers rather than the complete URL, particularly for data URLs. A diagnostic report can identify suspicious dimensions, but the audit has not proven a stale-cache collision for the failing pants.

## Evidence added

Controls → Advanced → **Start image trace** enables a bounded 400-event ring buffer for this browser session. **Download image trace** exports local JSON. Stop pauses collection; starting again clears the previous trace. Refreshing also resets it.

Events cover generation selections, metrics cache/pending reuse, preload load/error, decode start/settlement, metrics finalization, React board-image readiness/placeholder state, and the actual presented image load/error. Before React handles pointer interaction with a slot, a snapshot records placeholders, image completion/natural size, frame dimensions, computed visibility/transforms, and ancestor clipping. Export also captures a current snapshot.

There is no polling, no continuous layout measurement, and no automatic repair. Layout is measured only at trace start, interaction, and export. This avoids repeatedly forcing layout while waiting for the bug. Interaction snapshots are taken before React handlers, but pointer-over CSS may already apply; they are not screenshots of the pre-hover pixels.

Reports include item IDs, image filenames/source kind, browser version, origin, viewport, and styles. They omit image bytes, URL query strings/credentials, wardrobe records, and local source paths. They are not automatically transmitted or persisted.

## Reproduction protocol

1. Refresh the affected app after this code is running.
2. Start image trace in Controls → Advanced, then generate normally.
3. When pants disappear, wait about five seconds with the pointer away from the pants. Observe whether they recover unaided.
4. Move the pointer onto the empty pants area. If necessary, click once; note which action makes them appear.
5. Download the trace immediately, before refreshing or starting another trace. Send that JSON plus the browser/site and observed action. A short recording from generation to recovery is useful for matching invisible pixels to the trace.

Interpretation:

| Evidence | Next investigation |
|---|---|
| Placeholder persists; preload/decode never finishes | Pending loader/decode lifecycle. |
| Preload error or cached 1×1 dimensions | Source failure and error-cache handling. |
| Actual board image errors or has zero natural size | Board source/loading lifecycle. |
| Board image loaded with valid size but frame/ancestor clips it | Layout, crop, transforms, overflow. |
| Loaded image, valid frame, no state transition on hover, pixels appear | Browser paint/compositing becomes the leading explanation; compare recording and browser versions before changing CSS again. |
| Target becomes ready or placeholder disappears at hover | React/cache readiness path, distinct from a pure repaint failure. |

Validation: **397 tests pass**, production build passes. Exercised start → generate → pants interaction → JSON download → stop in the local test browser; verified generation events, actual board load events, and before-pointer snapshots in the downloaded JSON. The intermittent bug itself remains unresolved pending a trace from an occurrence.

## Follow-up: captured Brave occurrence

User supplied `outfit-image-trace-1791740958086.json` and confirmed hovering restored the pants. Environment: Brave reporting Chromium 154, macOS, localhost:5183, viewport 1762×1129.

- Final generation selected Lot.202 Engineer Trousers at 17:49:01.399 UTC.
- React reported ready, cached valid dimensions and no placeholder at 17:49:01.416.
- The actual board `<img>` fired load at 17:49:01.430: **31 ms after selection**; natural size 955×1400.
- Pointer entered the pants slot at 17:49:08.720: **7.290 seconds after load**.
- Interaction snapshot: complete image, natural size 955×1400, frame/image 150.06×219.98, visible display/opacity, frame inside the recorded clipping ancestors, no paint containment. Post-recovery export has identical pants geometry/styles.
- No Bottom load/readiness event occurs at or after hover in the trace. No preload errors or decode rejections occur anywhere in the captured session.

This rules out a continuing placeholder or pending load/readiness transition as the explanation for this captured occurrence. It strongly supports a paint/presentation failure. The snapshot is taken during pointer entry and cannot prove pre-hover pixel contents or pre-hover layout; it does not identify a specific Chromium defect or prove async decoding is the cause.

Controlled next change: set `decoding="sync"` on generated board images (`perfSlot`), retaining async decoding elsewhere and keeping the existing loading/CSS/state behavior. The [HTML decoding specification](https://html.spec.whatwg.org/multipage/images.html#decoding-images) defines sync as a preference for atomic image presentation with other content, whereas async allows other content to appear first. This is a targeted presentation test, not a confirmed fix. Repeat the same Brave workflow with a new trace; the snapshot should show `decoding: "sync"`. A recurrence under sync would justify investigating paint/compositing further rather than adjusting image fetching.
