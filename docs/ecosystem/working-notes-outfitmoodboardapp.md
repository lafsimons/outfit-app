# Working Notes

OA = Outfit-App  
MBA = Moodboard-App

Before making changes, read:
- docs/ecosystem/core.md
- docs/ecosystem/roadmap.md
- docs/ecosystem/working-notes.md

Preserve existing architecture direction and shared ecosystem goals.
Avoid introducing isolated app-specific logic when shared concepts already exist.

## Current local environments

```bash
npm run dev -- --host 0.0.0.0
````

- OA
    - https://layerfit.vercel.app/ — main dataset on mobile here right now
    - http://localhost:5173/
- MBA
    - http://localhost:5174/ — main dataset on Mac right now

---

## **OA current fixes**

- improve cropping

---

## **OA current refactor progress**

- Extracted item metadata and normalization helpers from `App.jsx` into `src/lib/itemModel.js`.
- Added `src/lib/itemModel.test.js`.
- Extracted basic image presentation normalization helpers from `App.jsx` into `src/lib/imagePresentation.js`.
- Extracted managed-image geometry helpers into `src/lib/imagePresentation.js`.
- Added regression coverage in `src/lib/imagePresentation.test.js`.
- Current goal: reduce `App.jsx` responsibilities without changing behavior.
- Image handling remains sensitive; do not “clean up” crop/scale/export math casually.
- Tests/build passed after current extraction steps.

---

## **OA image-system notes**

- Crop, scale, frame scale, offset, preview, and export alignment are tightly connected.
- `ManagedItemImage`, `useImageMetrics`, `resolveImageUrl`, export handlers, upload/compression handlers, and crop baking/migration are still intentionally left in `App.jsx`.
- Future crop fixes should be made after isolating behavior with regression tests.
- Avoid changing saved image fields unless migration/backward compatibility is explicitly handled.

---

## **OA mobile notes**

- move wardrobe controls below cards
- bottom-sheet behavior
- separate sort from filter

---

## **OA feature transfers from MBA**

- bulk editing
- multi-select
- double-click preview
- tag improvements
- auto metadata
- library virtualization if performance becomes an issue

---

## **OA architectural & generator concerns**

- Dresses/Jumpsuits slot integration
- TopInner accepting Outerwear
- minimum guided-score floor
- config-table refactor for defaults
- add tiny wardrobe test fixtures

---

## **OA temporary implementation notes**

- preserve import metadata
- preserve timestamps
- update updatedAt on edit only
- generation behavior must remain stable
- no UI redesign during metadata migration
- preserve backward compatibility for exports/imports where feasible

---

## **MBA fixes**

### **Tags**

- infinite nesting support
- keyboard selection improvements
- rename hierarchy issues

### **Crop**

- incorrect crop boundaries
- oversized crop UI on tall images

### **Canvas**

- occasional distortion
- preview/render mismatch

---

## **MBA temporary ideas**

- bulk rename
- ordered board generation
- higher image counts
- auto backup updates
- remove default images