import test from "node:test";
import assert from "node:assert/strict";

import {
  createImportedFitpicFromFile,
  normalizeFitpic,
  normalizeFitpics,
  replaceFitpicImageFromFile
} from "./fitpics.js";

test("normalizeFitpic preserves legacy fields while backfilling metadata and image contract", () => {
  const normalized = normalizeFitpic(
    {
      id: "fitpic_1",
      name: "IMG_1000",
      imageData: "data:image/png;base64,abc",
      createdAt: "2024-04-01T00:00:00.000Z"
    },
    {
      createUuid: () => "fitpic-uuid-1",
      fallbackTimestamp: "2024-04-01T00:00:00.000Z"
    }
  );

  assert.deepEqual(normalized, {
    id: "fitpic_1",
    fitpicUuid: "fitpic-uuid-1",
    name: "IMG_1000",
    description: "",
    tags: [],
    favorite: false,
    imageData: "data:image/png;base64,abc",
    images: {
      preview: "data:image/png;base64,abc",
      original: "",
      thumbnail: ""
    },
    createdAt: "2024-04-01T00:00:00.000Z",
    updatedAt: "2024-04-01T00:00:00.000Z",
    importedAt: "2024-04-01T00:00:00.000Z",
    sourceOriginalFilename: "",
    sourceFileSize: 0,
    sourceImageWidth: 0,
    sourceImageHeight: 0,
    sourceLastModified: "",
    importSource: "",
    sourceNamespace: "",
    sourceRelativePath: "",
    relinkStatus: "unknown",
    sourceFileExtension: "",
    sourceMimeType: "",
    sourceAspectRatio: 0,
    sourceOrientation: "unknown",
    sourceCapturedAt: "",
    sourceOriginalCreatedAt: "",
    sourceCameraMake: "",
    sourceCameraModel: "",
    sourceLensModel: ""
  });
});

test("normalizeFitpics keeps old records safe and ignores image-less entries", () => {
  const normalized = normalizeFitpics(
    [
      {
        name: "Legacy one",
        imageData: "data:image/jpeg;base64,one"
      },
      {
        id: "broken",
        name: "Missing image"
      }
    ],
    {
      createId: () => "generated-fitpic-id",
      createUuid: () => "generated-fitpic-uuid",
      fallbackTimestamp: "2024-04-02T00:00:00.000Z"
    }
  );

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, "generated-fitpic-id");
  assert.equal(normalized[0].fitpicUuid, "generated-fitpic-uuid");
  assert.equal(normalized[0].images.preview, "data:image/jpeg;base64,one");
});

test("createImportedFitpicFromFile captures shared metadata and preview image", async () => {
  const file = {
    name: "Look 01.PNG",
    size: 123456,
    lastModified: 1710000000000,
    type: "image/png"
  };

  const fitpic = await createImportedFitpicFromFile(file, {
    createId: () => "fitpic_1",
    createUuid: () => "fitpic-uuid-1",
    now: () => "2024-05-01T12:34:56.000Z",
    readFileAsDataUrl: async () => "data:image/png;base64,raw",
    loadImage: async () => ({
      naturalWidth: 1200,
      naturalHeight: 1600
    }),
    compressImageSource: async () => "data:image/webp;base64,preview"
  });

  assert.equal(fitpic.name, "Look 01");
  assert.equal(fitpic.imageData, "data:image/webp;base64,preview");
  assert.equal(fitpic.images.preview, "data:image/webp;base64,preview");
  assert.equal(fitpic.importedAt, "2024-05-01T12:34:56.000Z");
  assert.equal(fitpic.sourceOriginalFilename, "Look 01.PNG");
  assert.equal(fitpic.sourceFileExtension, "png");
  assert.equal(fitpic.sourceMimeType, "image/png");
  assert.equal(fitpic.sourceAspectRatio, 0.75);
  assert.equal(fitpic.sourceOrientation, "portrait");
});

test("replaceFitpicImageFromFile preserves editable fields and updates import metadata", async () => {
  const updated = await replaceFitpicImageFromFile(
    {
      id: "fitpic_1",
      fitpicUuid: "fitpic-uuid-1",
      name: "Edited name",
      description: "Notes",
      tags: ["Spring"],
      favorite: true,
      imageData: "data:image/png;base64,old",
      createdAt: "2024-01-01T00:00:00.000Z",
      importedAt: "2024-01-01T00:00:00.000Z"
    },
    {
      name: "Replacement.jpg",
      size: 333,
      lastModified: 1710000000000,
      type: "image/jpeg"
    },
    {
      now: () => "2024-06-01T10:00:00.000Z",
      readFileAsDataUrl: async () => "data:image/jpeg;base64,raw",
      loadImage: async () => ({
        naturalWidth: 1800,
        naturalHeight: 1200
      }),
      compressImageSource: async () => "data:image/webp;base64,new"
    }
  );

  assert.equal(updated.name, "Edited name");
  assert.equal(updated.description, "Notes");
  assert.deepEqual(updated.tags, ["Spring"]);
  assert.equal(updated.favorite, true);
  assert.equal(updated.createdAt, "2024-01-01T00:00:00.000Z");
  assert.equal(updated.updatedAt, "2024-06-01T10:00:00.000Z");
  assert.equal(updated.importedAt, "2024-06-01T10:00:00.000Z");
  assert.equal(updated.sourceOriginalFilename, "Replacement.jpg");
  assert.equal(updated.imageData, "data:image/webp;base64,new");
});
