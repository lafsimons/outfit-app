---
aliases:
  - library architecture
  - library project
---
# Library Architecture Proposal

This document defines the first practical architecture for `Library` as a fresh integration project.

The goal is to preserve the simplicity and durability of the `tt-library` file-backed metadata workflow while retaining the stronger feature layers from OA and MBA.

`Library` should be storage-first, portable, inspectable, and buildable from editable source files.

OA and MBA style generation features should sit on top of that storage model rather than replace it.

---

## Core Direction

`Library` should distinguish between:

- editable source data
- generated normalized library data
- feature overlays
- app runtime state

The durable source layer must remain understandable and recoverable outside the app.

That means:

- images live as files
- metadata lives in a stable tabular/package format
- stable IDs are preserved across tools
- the app is not the only place where truth can be created, repaired, or migrated

At the same time, `Library` should not force all advanced OA and MBA behavior into CSV.

The key correction from direct repo inspection is this:

- `tt-library` is not just folders plus a viewer
- it uses editable metadata sources plus a generated normalized dataset
- MBA is not just a taggable image grid
- it uses richer app-managed overlays and runtime state

The correct split is:

- source files for durable editable metadata
- a generated normalized item dataset for fast reliable app use
- overlay files for richer workflows
- local runtime state for disposable UI/app behavior

---

## Design Goals

- Keep the durable library understandable without the app.
- Make bulk metadata entry cleaner than app-only forms.
- Preserve phone-friendly portability and sync readiness.
- Allow in-app editing without making the app the only source of truth.
- Support OA outfit generation and MBA moodboard features from the same library core.
- Keep advanced workflows additive rather than destructive.

---

## Layer Model

### 1. Editable Source Layer

This is the canonical human-editable representation.

It should contain:

- item identity
- image file links
- metadata fields
- manual tags
- import provenance
- lightweight asset-level technical metadata
- import-side source files that can be edited in bulk

This layer must be editable outside the app.

Examples:

- `items.csv`
- image folders
- auxiliary metadata CSV files
- library manifest/config files

### 2. Generated Normalized Dataset

This is the canonical app-facing item catalog built from the source layer.

It should contain:

- one normalized record per logical item
- resolved file links
- normalized tags and metadata fields
- stable IDs preserved from source where possible
- derived fields needed for filtering, browsing, and generation

This layer is similar to `tt-library`'s generated [archive.json](/Users/lafsimons/Documents/tt-archive/src/data/archive.json).

It is generated, validated, and replaceable.

It should not become the only editable source of truth.

### 3. Feature Overlays

These are durable, but not part of the minimal portable asset catalog.

Examples:

- OA saved outfits
- MBA boards
- cross-item relationships
- inspiration links
- derived cluster/group records

Feature overlays may live in JSON, NDJSON, or package records rather than in the core source CSV files.

### 4. App Runtime State

This is local and disposable.

Examples:

- current filters
- selected items
- temporary drafts
- viewport preferences
- sync cursors
- transient UI state

Runtime state should not be part of the canonical library format.

---

## Canonical On-Disk Shape

Initial proposal:

```text
Library/
├─ manifest.json
├─ metadata/
│  ├─ items.csv
│  ├─ item-tags.csv
│  └─ sources/
├─ images/
│  ├─ originals/
│  ├─ display/
│  └─ preview/
├─ generated/
│  └─ library.json
├─ overlays/
│  ├─ saved-outfits.ndjson
│  ├─ boards.ndjson
│  └─ relationships.ndjson
└─ exports/
```

Notes:

- `metadata/items.csv` is the primary editable metadata table for wardrobe/reference items.
- `generated/library.json` is the normalized dataset produced from the editable source layer.
- `manifest.json` records library-level information and schema versions.
- `images/` stores portable media assets.
- `metadata/sources/` can hold auxiliary import-side source files when needed.
- `overlays/` stores richer app features that should remain portable but do not belong in CSV.
- `exports/` is optional and should not be treated as canonical input.

---

## `items.csv` Role

`items.csv` is the primary editable metadata source for item-level library data.

It should support:

- manual tagging
- bulk editing
- spreadsheet workflows
- metadata repair
- file-based ingestion
- stable export/import between `tt-library`, OA, MBA, and future tools
- generation of a normalized runtime dataset

`items.csv` should describe one logical item per row.

It should not try to encode full saved outfits, boards, drafts, or complex nested image-state structures.

It should feed a generated normalized catalog rather than serving as the only runtime representation.

---

## Generated Dataset Role

The generated dataset exists so the app can stay fast, deterministic, and simple at runtime.

It should support:

- normalized filtering
- stable browsing
- validation
- derived fields
- feature adapters that should not parse raw CSV directly on every render

The generated dataset should be rebuildable from:

- source metadata files
- image folders
- overlay references where needed

If the generated dataset is lost, the library should still be recoverable from the source layer.

---

## `items.csv` Initial Schema

Start from the OA export contract because it already exists and is broad enough to be useful.

Initial columns:

```text
id
itemUuid
name
brand
garment
layerType
accessorySlot
type
color
status
list
favorite
size
weight
quantity
paid
worth
collections
styleTags
climateTags
description
importedAt
sourceOriginalFilename
sourceFileSize
sourceImageWidth
sourceImageHeight
sourceLastModified
importSource
sourceNamespace
sourceRelativePath
relinkStatus
sourceFileExtension
sourceMimeType
sourceAspectRatio
sourceOrientation
sourceCapturedAt
sourceOriginalCreatedAt
sourceCameraMake
sourceCameraModel
sourceLensModel
originalPreserved
archivalOriginalPreserved
createdAt
updatedAt
imageFilename
imageWidth
imageHeight
```

This is intentionally close to the existing OA export in [src/lib/libraryExport.js](/Users/lafsimons/Desktop/outfit-app/src/lib/libraryExport.js).

Rules:

- `itemUuid` is the canonical stable identity.
- `id` is optional and may remain app-local or legacy.
- pipe-delimited fields such as `collections`, `styleTags`, and `climateTags` remain acceptable for v1.
- unknown future columns should be preserved when possible.

This file is the editable source contract, not the final normalized runtime shape.

---

## Required vs Optional Fields

### Required in v1

- `itemUuid`
- `imageFilename` or `sourceRelativePath`
- enough metadata to classify the item for browsing

### Strongly recommended in v1

- `name`
- `brand`
- `garment`
- `type`
- `color`
- `status`

### Optional in v1

- acquisition fields like `paid` and `worth`
- camera/source provenance
- preservation flags
- advanced research tags

The app must tolerate sparse CSV rows.

---

## Matching Rules

CSV rows need deterministic matching to image files and existing records.

Primary matching order:

1. `itemUuid`
2. `sourceRelativePath`
3. `imageFilename`
4. explicit user-assisted relink

Rules:

- `itemUuid` wins when present.
- filename-only matching is a fallback, not the default truth source.
- duplicate matches must surface as import warnings rather than silently guessing.
- relink state should remain additive and repairable.

The build step should emit validation warnings rather than bury matching failures inside runtime state.

---

## Media Policy

Preview-first remains the correct portable policy.

That means:

- normal browsing should depend on preview/display assets
- originals are optional archival assets
- missing originals must not break the library
- sync and phone access should prefer preview/display variants

Initial media directories:

- `images/originals/`
- `images/display/`
- `images/preview/`

If this proves too heavy for early implementation, v1 can start with:

- `images/`
- optional generated preview cache

But the schema should reserve room for explicit variants.

---

## What Belongs In CSV

Good CSV fields:

- descriptive tags
- category/type fields
- wardrobe state
- provenance
- capture/import metadata
- manual notes
- lightweight numeric values

Bad CSV fields:

- nested board layout state
- saved outfit slot geometry
- image payloads
- sync cursors
- transient UI state
- large structured graph data

If a field stops being readable as a row-level property, it probably belongs in an overlay file instead.

---

## What Belongs In Overlays

Overlay files should contain richer domain records that are still portable.

Examples:

- `saved-outfits.ndjson`
- `boards.ndjson`
- `relationships.ndjson`
- `fitpics.ndjson`

Overlay records should reference `itemUuid` rather than duplicate full item metadata.

That preserves a clean dependency direction:

- `items.csv` defines the core item catalog
- overlays build on top of the item catalog

---

## In-App Editing Policy

In-app editing remains valuable.

`Library` should support both:

- spreadsheet-first metadata work
- in-app metadata edits

In-app edits should write back to the durable library model rather than only mutating ephemeral app state.

Practical rule:

- item-level metadata edits update `items.csv` compatible fields
- normalized generated data is then rebuilt or incrementally refreshed
- richer feature edits update overlay files
- runtime state remains local-only

---

## Import Modes

`Library` should support three import modes for item metadata.

### CSV Only

Use CSV rows to update existing items and rebuild the normalized dataset.

Best for:

- retagging
- cleanup
- external spreadsheet workflows

### Images Plus CSV

Import a folder of images and reconcile metadata rows against them, then regenerate the normalized dataset.

Best for:

- `tt-library` style ingestion
- fresh library bootstraps
- cross-device package restoration

### App Package Import

Import a richer OA or MBA package and materialize it into:

- `metadata/items.csv`
- media files
- generated normalized data
- overlay records

Best for:

- migration from legacy apps
- full-fidelity recovery

---

## Sync Direction

The core sync target should follow the `tt-library` philosophy:

- sync files plus durable metadata representation
- keep the app replaceable

Practical direction:

- local source files remain the user-readable source artifact
- cloud storage mirrors the source and overlay package
- generated datasets and app-local runtime caches can be rebuilt

This aligns with existing OA backup/package and sync planning:

- [src/lib/backupPackageV2.js](/Users/lafsimons/Desktop/outfit-app/src/lib/backupPackageV2.js)
- [docs/ecosystem/sync-cloud-v1-outfitmoodboardapp.md](/Users/lafsimons/Desktop/outfit-app/docs/ecosystem/sync-cloud-v1-outfitmoodboardapp.md)

---

## Feature Integration Strategy

`Library` should not start as a mega-app.

Integration order:

1. source reader/writer and build pipeline
2. library browser and metadata editor
3. OA outfit generator adapter
4. MBA moodboard adapter
5. sync and phone-friendly viewer

This keeps the architecture coherent:

- storage first
- features second
- sync third

---

## Day 1 Scope

The first working milestone for `Library` should be intentionally small.

Build:

- load `metadata/items.csv`
- load image files
- resolve rows to images
- generate normalized `generated/library.json`
- show grid/list from the generated dataset
- basic filters
- edit core metadata
- save back to `metadata/items.csv`

Do not build first:

- full outfit generation
- full moodboard editing
- deep sync engine
- complex relationship UI

Those should arrive after the core storage boundary is stable.

---

## Open Questions

- Should `items.csv` remain a single table for both wardrobe and inspiration/reference items, or should there be separate catalogs later?
- Should fitpics be an overlay from day 1 or deferred until OA feature import begins?
- Should preview assets be eagerly materialized on import or generated lazily?
- Should the canonical package be directory-first, zip-first, or support both equally?
- Should tags remain pipe-delimited in CSV, or should a sidecar normalized tag table be introduced later?

---

## Immediate Next Steps

1. Freeze `tt-library`, OA, and MBA as backup/reference projects.
2. Create a fresh `Library` integration workspace.
3. Reuse the OA CSV contract as the v1 `metadata/items.csv` schema.
4. Define the first build step from source files to `generated/library.json`.
5. Decide the v1 directory layout for images and overlays.
6. Build the smallest reader/editor before porting generation features.

---

## Summary Decision

`Library` should be:

- file-backed
- source-file-centered for core item metadata
- generated-dataset-backed for runtime browsing and feature adapters
- overlay-based for richer features
- app-assisted rather than app-owned

OA and MBA features should become clients of that shared library model, not the other way around.
