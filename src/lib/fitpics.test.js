import test from "node:test";
import assert from "node:assert/strict";

import {
  createImportedGroupedFitpicFromFiles,
  createImportedFitpicFromFile,
  getFitpicImageEntities,
  getPrimaryFitpicImage,
  normalizeFitpic,
  normalizeFitpics,
  replaceFitpicImageFromFile
} from "./fitpics.js";

test("legacy fitpic normalizes to one primary fitpic image while preserving legacy aliases", () => {
  const normalized = normalizeFitpic(
    {
      id: "fitpic_1",
      name: "IMG_1000",
      imageData: "data:image/png;base64,abc",
      createdAt: "2024-04-01T00:00:00.000Z"
    },
    {
      createUuid: () => "fitpic-uuid-1",
      createFitpicImageUuid: () => "fitpic-image-uuid-1",
      fallbackTimestamp: "2024-04-01T00:00:00.000Z"
    }
  );

  assert.equal(normalized.fitpicUuid, "fitpic-uuid-1");
  assert.equal(normalized.primaryImageUuid, "fitpic-image-uuid-1");
  assert.equal(normalized.imageData, "data:image/png;base64,abc");
  assert.deepEqual(normalized.images, {
    display: "data:image/png;base64,abc",
    preview: "data:image/png;base64,abc",
    original: "",
    thumbnail: ""
  });
  assert.equal(normalized.fitpicImages.length, 1);
  assert.deepEqual(normalized.fitpicImages[0], {
    fitpicImageUuid: "fitpic-image-uuid-1",
    parentFitpicUuid: "fitpic-uuid-1",
    order: 0,
    imageData: "data:image/png;base64,abc",
    images: {
      display: "data:image/png;base64,abc",
      preview: "data:image/png;base64,abc",
      original: "",
      thumbnail: ""
    },
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
    sourceLensModel: "",
    imageKind: "",
    originalPreserved: false,
    archivalOriginalPreserved: false
  });
  assert.equal(normalized.fitDate, "2024-04-01T00:00:00.000Z");
});

test("new multi-image fitpic preserves image sub-records and primary selection", () => {
  const normalized = normalizeFitpic(
    {
      id: "fitpic_multi",
      fitpicUuid: "fitpic-uuid-multi",
      name: "Multi",
      description: "Notes",
      tags: ["Detail"],
      favorite: true,
      fitDate: "2024-05-01T00:00:00.000Z",
      primaryImageUuid: "image-uuid-2",
      fitpicImages: [
        {
          fitpicImageUuid: "image-uuid-1",
          order: 2,
          imageData: "data:image/png;base64,one",
          sourceOriginalFilename: "one.png"
        },
        {
          fitpicImageUuid: "image-uuid-2",
          order: 1,
          imageData: "data:image/png;base64,two",
          images: { original: "blob:two" },
          sourceOriginalFilename: "two.png"
        }
      ]
    },
    {
      createFitpicImageUuid: () => "generated-image-uuid",
      fallbackTimestamp: "2024-05-02T00:00:00.000Z"
    }
  );

  assert.equal(normalized.fitpicImages.length, 2);
  assert.deepEqual(
    normalized.fitpicImages.map((fitpicImage) => ({
      fitpicImageUuid: fitpicImage.fitpicImageUuid,
      parentFitpicUuid: fitpicImage.parentFitpicUuid,
      order: fitpicImage.order,
      imageData: fitpicImage.imageData
    })),
    [
      {
        fitpicImageUuid: "image-uuid-2",
        parentFitpicUuid: "fitpic-uuid-multi",
        order: 0,
        imageData: "data:image/png;base64,two"
      },
      {
        fitpicImageUuid: "image-uuid-1",
        parentFitpicUuid: "fitpic-uuid-multi",
        order: 1,
        imageData: "data:image/png;base64,one"
      }
    ]
  );
  assert.equal(normalized.primaryImageUuid, "image-uuid-2");
  assert.equal(normalized.imageData, "data:image/png;base64,two");
  assert.equal(normalized.images.original, "blob:two");
  assert.equal(normalized.images.display, "data:image/png;base64,two");
});

test("normalized multi-image fitpics preserve stable image uuids and backfill missing ones", () => {
  const normalized = normalizeFitpic(
    {
      fitpicUuid: "fitpic-uuid-stable",
      imageData: "data:image/png;base64,legacy",
      fitpicImages: [
        {
          fitpicImageUuid: "keep-me",
          order: 0,
          imageData: "data:image/png;base64,one"
        },
        {
          order: 1,
          imageData: "data:image/png;base64,two"
        }
      ]
    },
    {
      createFitpicImageUuid: () => "generated-image-uuid",
      fallbackTimestamp: "2024-04-01T00:00:00.000Z"
    }
  );

  assert.equal(normalized.fitpicImages[0].fitpicImageUuid, "keep-me");
  assert.equal(normalized.fitpicImages[1].fitpicImageUuid, "generated-image-uuid");
  assert.equal(normalized.fitpicImages[1].parentFitpicUuid, "fitpic-uuid-stable");
});

test("missing or invalid primaryImageUuid falls back safely to the first image", () => {
  const normalized = normalizeFitpic(
    {
      fitpicUuid: "fitpic-uuid-fallback",
      primaryImageUuid: "missing-image",
      fitpicImages: [
        {
          fitpicImageUuid: "image-uuid-1",
          imageData: "data:image/png;base64,one"
        },
        {
          fitpicImageUuid: "image-uuid-2",
          imageData: "data:image/png;base64,two"
        }
      ]
    },
    {
      fallbackTimestamp: "2024-04-01T00:00:00.000Z"
    }
  );

  assert.equal(normalized.primaryImageUuid, "image-uuid-1");
  assert.equal(getPrimaryFitpicImage(normalized)?.fitpicImageUuid, "image-uuid-1");
  assert.equal(normalized.imageData, "data:image/png;base64,one");
});

test("normalizeFitpics keeps image-bearing records safe and ignores fitpics with no valid images", () => {
  const normalized = normalizeFitpics(
    [
      {
        name: "Legacy one",
        imageData: "data:image/jpeg;base64,one"
      },
      {
        id: "multi",
        fitpicUuid: "multi-uuid",
        fitpicImages: [
          {
            fitpicImageUuid: "multi-image-1",
            imageData: "data:image/jpeg;base64,two"
          }
        ]
      },
      {
        id: "broken",
        name: "Missing image"
      }
    ],
    {
      createId: () => "generated-fitpic-id",
      createUuid: () => "generated-fitpic-uuid",
      createFitpicImageUuid: () => "generated-fitpic-image-uuid",
      fallbackTimestamp: "2024-04-02T00:00:00.000Z"
    }
  );

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id, "generated-fitpic-id");
  assert.equal(normalized[0].fitpicImages.length, 1);
  assert.equal(normalized[1].fitpicUuid, "multi-uuid");
});

test("createImportedFitpicFromFile captures shared metadata and creates one nested image", async () => {
  const file = {
    name: "Look 01.PNG",
    size: 123456,
    lastModified: 1710000000000,
    type: "image/png"
  };

  const fitpic = await createImportedFitpicFromFile(file, {
    createId: () => "fitpic_1",
    createUuid: () => "fitpic-uuid-1",
    createFitpicImageUuid: () => "fitpic-image-uuid-1",
    now: () => "2024-05-01T12:34:56.000Z",
    readFileAsDataUrl: async () => "data:image/png;base64,raw",
    loadImage: async () => ({
      naturalWidth: 1200,
      naturalHeight: 1600
    }),
    buildImportedImageAssetSet: async () => ({
      originalPreserved: false,
      archivalOriginalPreserved: true,
      original: { src: "data:image/webp;base64,original" },
      display: { src: "data:image/webp;base64,preview" },
      thumbnail: { src: "data:image/webp;base64,thumb" }
    })
  });

  assert.equal(fitpic.name, "Look 01");
  assert.equal(fitpic.primaryImageUuid, "fitpic-image-uuid-1");
  assert.equal(fitpic.fitpicImages.length, 1);
  assert.equal(fitpic.fitpicImages[0].parentFitpicUuid, "fitpic-uuid-1");
  assert.equal(fitpic.fitpicImages[0].imageData, "data:image/webp;base64,preview");
  assert.equal(fitpic.imageData, "data:image/webp;base64,preview");
  assert.equal(fitpic.fitpicImages[0].images.original, "data:image/webp;base64,original");
  assert.equal(fitpic.images.preview, "data:image/webp;base64,preview");
  assert.equal(fitpic.images.display, "data:image/webp;base64,preview");
  assert.equal(fitpic.images.thumbnail, "data:image/webp;base64,thumb");
  assert.equal(fitpic.originalPreserved, false);
  assert.equal(fitpic.archivalOriginalPreserved, true);
  assert.equal(fitpic.importedAt, "2024-05-01T12:34:56.000Z");
  assert.equal(fitpic.fitDate, "2024-05-01T12:34:56.000Z");
});

test("createImportedGroupedFitpicFromFiles creates one multi-image fitpic with the first image as primary", async () => {
  const uuidSequence = ["fitpic-image-uuid-1", "fitpic-image-uuid-2"];
  const grouped = await createImportedGroupedFitpicFromFiles(
    [
      {
        name: "Front.png",
        size: 111,
        lastModified: 1710000000000,
        type: "image/png"
      },
      {
        name: "Detail.png",
        size: 222,
        lastModified: 1710000001000,
        type: "image/png"
      }
    ],
    {
      createId: () => "fitpic_grouped_1",
      createUuid: () => "fitpic-uuid-grouped-1",
      createFitpicImageUuid: () => uuidSequence.shift(),
      now: () => "2024-05-03T08:00:00.000Z",
      readFileAsDataUrl: async () => "data:image/png;base64,raw",
      loadImage: async () => ({
        naturalWidth: 1200,
        naturalHeight: 1600
      }),
      buildImportedImageAssetSet: async (file) => ({
        originalPreserved: file.name === "Front.png",
        archivalOriginalPreserved: file.name !== "Front.png",
        original: { src: `data:image/webp;base64,original-${file.name}` },
        display: { src: `data:image/webp;base64,${file.name}` },
        thumbnail: { src: `data:image/webp;base64,thumb-${file.name}` }
      })
    }
  );

  assert.equal(grouped.name, "Front");
  assert.equal(grouped.primaryImageUuid, "fitpic-image-uuid-1");
  assert.equal(grouped.fitDate, "2024-05-03T08:00:00.000Z");
  assert.equal(grouped.fitpicImages.length, 2);
  assert.deepEqual(
    grouped.fitpicImages.map((fitpicImage) => ({
      fitpicImageUuid: fitpicImage.fitpicImageUuid,
      parentFitpicUuid: fitpicImage.parentFitpicUuid,
      order: fitpicImage.order,
      imageData: fitpicImage.imageData,
      sourceOriginalFilename: fitpicImage.sourceOriginalFilename
    })),
    [
      {
        fitpicImageUuid: "fitpic-image-uuid-1",
        parentFitpicUuid: "fitpic-uuid-grouped-1",
        order: 0,
        imageData: "data:image/webp;base64,Front.png",
        sourceOriginalFilename: "Front.png"
      },
      {
        fitpicImageUuid: "fitpic-image-uuid-2",
        parentFitpicUuid: "fitpic-uuid-grouped-1",
        order: 1,
        imageData: "data:image/webp;base64,Detail.png",
        sourceOriginalFilename: "Detail.png"
      }
    ]
  );
  assert.equal(grouped.imageData, "data:image/webp;base64,Front.png");
  assert.equal(grouped.images.preview, "data:image/webp;base64,Front.png");
  assert.equal(grouped.images.display, "data:image/webp;base64,Front.png");
  assert.equal(grouped.images.original, "data:image/webp;base64,original-Front.png");
  assert.equal(grouped.originalPreserved, true);
  assert.equal(grouped.archivalOriginalPreserved, false);
});

test("createImportedGroupedFitpicFromFiles supports a one-file grouped import", async () => {
  const grouped = await createImportedGroupedFitpicFromFiles(
    [
      {
        name: "Solo.png",
        size: 111,
        lastModified: 1710000000000,
        type: "image/png"
      }
    ],
    {
      createId: () => "fitpic_grouped_solo",
      createUuid: () => "fitpic-uuid-grouped-solo",
      createFitpicImageUuid: () => "fitpic-image-uuid-solo",
      now: () => "2024-05-03T09:00:00.000Z",
      readFileAsDataUrl: async () => "data:image/png;base64,raw",
      loadImage: async () => ({
        naturalWidth: 800,
        naturalHeight: 1000
      }),
      buildImportedImageAssetSet: async () => ({
        originalPreserved: true,
        archivalOriginalPreserved: false,
        original: { src: "data:image/png;base64,solo-original" },
        display: { src: "data:image/webp;base64,solo" },
        thumbnail: { src: "data:image/webp;base64,solo-thumb" }
      })
    }
  );

  assert.equal(grouped.primaryImageUuid, "fitpic-image-uuid-solo");
  assert.equal(grouped.fitpicImages.length, 1);
  assert.equal(grouped.fitpicImages[0].parentFitpicUuid, "fitpic-uuid-grouped-solo");
  assert.equal(grouped.imageData, "data:image/webp;base64,solo");
});

test("replaceFitpicImageFromFile replaces the primary nested image while preserving parent metadata and other images", async () => {
  const updated = await replaceFitpicImageFromFile(
    {
      id: "fitpic_1",
      fitpicUuid: "fitpic-uuid-1",
      name: "Edited name",
      description: "Notes",
      tags: ["Spring"],
      favorite: true,
      fitDate: "2024-01-15T00:00:00.000Z",
      primaryImageUuid: "primary-image-uuid",
      fitpicImages: [
        {
          fitpicImageUuid: "primary-image-uuid",
          order: 0,
          imageData: "data:image/png;base64,old",
          importedAt: "2024-01-01T00:00:00.000Z"
        },
        {
          fitpicImageUuid: "secondary-image-uuid",
          order: 1,
          imageData: "data:image/png;base64,detail",
          importedAt: "2024-01-02T00:00:00.000Z"
        }
      ],
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
      buildImportedImageAssetSet: async () => ({
        originalPreserved: false,
        archivalOriginalPreserved: true,
        original: { src: "data:image/webp;base64,new-original" },
        display: { src: "data:image/webp;base64,new" },
        thumbnail: { src: "data:image/webp;base64,new-thumb" }
      })
    }
  );

  assert.equal(updated.name, "Edited name");
  assert.equal(updated.description, "Notes");
  assert.deepEqual(updated.tags, ["Spring"]);
  assert.equal(updated.favorite, true);
  assert.equal(updated.createdAt, "2024-01-01T00:00:00.000Z");
  assert.equal(updated.updatedAt, "2024-06-01T10:00:00.000Z");
  assert.equal(updated.fitDate, "2024-01-15T00:00:00.000Z");
  assert.equal(updated.imageData, "data:image/webp;base64,new");
  assert.equal(updated.images.original, "data:image/webp;base64,new-original");
  assert.equal(updated.fitpicImages.length, 2);
  assert.equal(updated.fitpicImages[0].fitpicImageUuid, "primary-image-uuid");
  assert.equal(updated.fitpicImages[0].imageData, "data:image/webp;base64,new");
  assert.equal(updated.fitpicImages[1].fitpicImageUuid, "secondary-image-uuid");
  assert.equal(updated.fitpicImages[1].imageData, "data:image/png;base64,detail");
});

test("normalizeFitpic preserves explicit fitDate links and future saved outfit placeholders", () => {
  const normalized = normalizeFitpic({
    id: "fitpic_2",
    fitpicUuid: "fitpic-uuid-2",
    name: "Linked",
    imageData: "data:image/png;base64,linked",
    fitDate: "2024-06-10T00:00:00.000Z",
    linkedItemUuids: ["item-uuid-1", "item-uuid-1", "item-uuid-2"],
    linkedItemIds: ["item_1", "", "item_2"],
    savedOutfitUuid: "outfit-uuid-1",
    savedOutfitId: "saved_1",
    createdAt: "2024-06-01T00:00:00.000Z"
  });

  assert.equal(normalized.fitDate, "2024-06-10T00:00:00.000Z");
  assert.deepEqual(normalized.linkedItemUuids, ["item-uuid-1", "item-uuid-2"]);
  assert.deepEqual(normalized.linkedItemIds, ["item_1", "item_2"]);
  assert.equal(normalized.savedOutfitUuid, "outfit-uuid-1");
  assert.equal(normalized.savedOutfitId, "saved_1");
});

test("normalizeFitpic fitDate fallback prefers capture metadata before import timestamps", () => {
  const fromCaptured = normalizeFitpic({
    name: "Captured",
    imageData: "data:image/png;base64,captured",
    sourceCapturedAt: "2024-03-01T00:00:00.000Z",
    sourceOriginalCreatedAt: "2024-02-01T00:00:00.000Z",
    importedAt: "2024-04-01T00:00:00.000Z",
    createdAt: "2024-05-01T00:00:00.000Z"
  });
  const fromOriginalCreated = normalizeFitpic({
    name: "Original",
    imageData: "data:image/png;base64,original",
    sourceOriginalCreatedAt: "2024-02-01T00:00:00.000Z",
    importedAt: "2024-04-01T00:00:00.000Z",
    createdAt: "2024-05-01T00:00:00.000Z"
  });
  const fromImported = normalizeFitpic({
    name: "Imported",
    imageData: "data:image/png;base64,imported",
    importedAt: "2024-04-01T00:00:00.000Z",
    createdAt: "2024-05-01T00:00:00.000Z"
  });

  assert.equal(fromCaptured.fitDate, "2024-03-01T00:00:00.000Z");
  assert.equal(fromOriginalCreated.fitDate, "2024-02-01T00:00:00.000Z");
  assert.equal(fromImported.fitDate, "2024-04-01T00:00:00.000Z");
});

test("getFitpicImageEntities returns lightweight future-facing image library entities", () => {
  const entities = getFitpicImageEntities(
    normalizeFitpic({
      fitpicUuid: "fitpic-uuid-entities",
      name: "Archive Look",
      fitDate: "2024-06-01T00:00:00.000Z",
      tags: ["Detail", "Footwear"],
      favorite: true,
      fitpicImages: [
        {
          fitpicImageUuid: "image-uuid-1",
          order: 0,
          imageData: "data:image/png;base64,front",
          sourceOriginalFilename: "front.png"
        },
        {
          fitpicImageUuid: "image-uuid-2",
          order: 1,
          imageData: "data:image/png;base64,detail",
          sourceOriginalFilename: "detail.png"
        }
      ]
    })
  );

  assert.deepEqual(
    entities.map((entity) => ({
      entityType: entity.entityType,
      fitpicUuid: entity.fitpicUuid,
      fitpicImageUuid: entity.fitpicImageUuid,
      parentFitpicUuid: entity.parentFitpicUuid,
      order: entity.order,
      name: entity.name,
      fitDate: entity.fitDate,
      tags: entity.tags,
      favorite: entity.favorite,
      sourceOriginalFilename: entity.sourceOriginalFilename
    })),
    [
      {
        entityType: "fitpicImage",
        fitpicUuid: "fitpic-uuid-entities",
        fitpicImageUuid: "image-uuid-1",
        parentFitpicUuid: "fitpic-uuid-entities",
        order: 0,
        name: "Archive Look",
        fitDate: "2024-06-01T00:00:00.000Z",
        tags: ["Detail", "Footwear"],
        favorite: true,
        sourceOriginalFilename: "front.png"
      },
      {
        entityType: "fitpicImage",
        fitpicUuid: "fitpic-uuid-entities",
        fitpicImageUuid: "image-uuid-2",
        parentFitpicUuid: "fitpic-uuid-entities",
        order: 1,
        name: "Archive Look",
        fitDate: "2024-06-01T00:00:00.000Z",
        tags: ["Detail", "Footwear"],
        favorite: true,
        sourceOriginalFilename: "detail.png"
      }
    ]
  );
});
