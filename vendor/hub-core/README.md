# hub-core

## Hub Phase 1A scope

`hub-core` is the first shared infrastructure package for OA and MBA.

Phase 1A is limited to shared backup package primitives only.

## What hub-core currently owns

- Generic backup/package helper primitives
- Safe filename/path segment sanitization
- MIME and extension inference helpers
- NDJSON serialization and line streaming helpers
- Generic warning report and count normalization helpers

## What is intentionally excluded

- OA and MBA backup schemas
- OA and MBA manifest field definitions
- OA and MBA warning text
- OA and MBA ZIP path structure
- Media stores
- Image derivatives
- Tags
- Selection
- UI
- Repositories
- Import/export workflows

## Rule

`hub-core` contains generic primitives only.

It must not introduce OA or MBA domain concepts into shared helpers.

If extracting a helper would require changing existing OA/MBA warning text, manifest fields, ZIP paths, or observable validation behavior, that helper stays app-specific.

## Distribution in outfit-app

This directory contains a vendored copy of `hub-core` version 0.1.0.
It is committed with outfit-app so deployments and fresh checkouts do not require
a sibling `../hub-core` checkout. Keep these generic backup primitives in sync
with the shared package when updating them.
