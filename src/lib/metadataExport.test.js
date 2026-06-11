import test from "node:test";
import assert from "node:assert/strict";

import {
  FITPIC_EXPORT_COLUMNS,
  SAVED_OUTFIT_EXPORT_COLUMNS,
  createFitpicExportRecord,
  createSavedOutfitExportRecord,
  escapeCsvCell,
  sanitizeImageReference,
  serializeFitpicsCsv,
  serializeFitpicsJson,
  serializeSavedOutfitsCsv,
  serializeSavedOutfitsJson
} from "./metadataExport.js";

const items = [
  {
    id: "head_1",
    itemUuid: "uuid-head-1",
    brand: "Kapital",
    name: "Watch Cap",
    imageUrl: "/images/watch-cap.png"
  },
  {
    id: "top_1",
    itemUuid: "uuid-top-1",
    brand: "Lemaire",
    name: "Twisted Shirt",
    imageUrl: "/images/twisted-shirt.png"
  },
  {
    id: "shoe_1",
    itemUuid: "uuid-shoe-1",
    brand: "Guidi",
    name: "992",
    imageUrl: "/images/guidi-992.png"
  }
];

test("saved outfit export record preserves arrays and resolves slot metadata", () => {
  assert.deepEqual(
    createSavedOutfitExportRecord(
      {
        id: "saved_1",
        outfitUuid: "outfit-uuid-1",
        name: "Monochrome",
        description: "Notes,\nwith newline",
        tags: ["black", "summer"],
        favorite: true,
        layering: true,
        createdAt: "2024-06-01T00:00:00.000Z",
        updatedAt: "2024-06-02T00:00:00.000Z",
        outfit: {
          Headwear: "head_1",
          TopInner: "top_1",
          Footwear: "shoe_1"
        },
        outfitItemUuids: {
          Headwear: "uuid-head-1",
          TopInner: "uuid-top-1",
          Footwear: "uuid-shoe-1"
        }
      },
      items
    ),
    {
      id: "saved_1",
      outfitUuid: "outfit-uuid-1",
      title: "Monochrome",
      description: "Notes,\nwith newline",
      tags: ["black", "summer"],
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-02T00:00:00.000Z",
      favorite: true,
      layering: true,
      generationMode: "",
      weather: "",
      season: "",
      context: "",
      includedItemIds: ["head_1", "top_1", "shoe_1"],
      includedItemUuids: ["uuid-head-1", "uuid-top-1", "uuid-shoe-1"],
      includedItemNames: ["Kapital Watch Cap", "Lemaire Twisted Shirt", "Guidi 992"],
      headwearItemId: "head_1",
      headwearItemUuid: "uuid-head-1",
      headwearItemName: "Kapital Watch Cap",
      topItemId: "top_1",
      topItemUuid: "uuid-top-1",
      topItemName: "Lemaire Twisted Shirt",
      outerLayerItemId: "",
      outerLayerItemUuid: "",
      outerLayerItemName: "",
      bottomItemId: "",
      bottomItemUuid: "",
      bottomItemName: "",
      footwearItemId: "shoe_1",
      footwearItemUuid: "uuid-shoe-1",
      footwearItemName: "Guidi 992",
      accessories: [],
      previewImageUrl: "/images/watch-cap.png",
      futureImageLink: ""
    }
  );
});

test("saved outfit preview image priority prefers explicit fields over item images", () => {
  assert.equal(
    createSavedOutfitExportRecord(
      {
        id: "saved_2",
        previewImageUrl: "data:image/png;base64,nope",
        imageUrl: "/images/direct-image.png",
        renderUrl: "/images/render.png",
        outfit: { Headwear: "head_1" },
        outfitItemUuids: { Headwear: "uuid-head-1" }
      },
      items
    ).previewImageUrl,
    "/images/direct-image.png"
  );

  assert.equal(
    createSavedOutfitExportRecord(
      {
        id: "saved_3",
        renderUrl: "/images/render.png",
        outfit: { Headwear: "head_1" },
        outfitItemUuids: { Headwear: "uuid-head-1" }
      },
      items
    ).previewImageUrl,
    "/images/render.png"
  );
});

test("fitpic export record sanitizes base64 images and includes imageUrls list", () => {
  assert.deepEqual(
    createFitpicExportRecord(
      {
        id: "fitpic_1",
        fitpicUuid: "fitpic-uuid-1",
        name: "Mirror fit",
        description: "Soft, relaxed fit",
        tags: ["mirror", "summer"],
        favorite: true,
        createdAt: "2024-06-01T00:00:00.000Z",
        importedAt: "2024-06-03T00:00:00.000Z",
        updatedAt: "2024-06-04T00:00:00.000Z",
        fitDate: "2024-06-02",
      linkedItemIds: ["top_1", "missing_1"],
      linkedItemUuids: ["uuid-top-1", ""],
      primaryImageUuid: "fitpic-image-1",
      images: {
        preview: "data:image/png;base64,discard"
        },
        fitpicImages: [
          {
            fitpicImageUuid: "fitpic-image-1",
            imageData: "data:image/png;base64,discard",
            images: {
              original: "https://cdn.example.com/fitpic-1-original.jpg",
              preview: "data:image/png;base64,discard"
            }
          },
          {
            fitpicImageUuid: "fitpic-image-2",
            images: {
              preview: "/images/fitpic-1-alt.jpg"
            }
          }
        ]
      },
      items
    ),
    {
      id: "fitpic_1",
      fitpicUuid: "fitpic-uuid-1",
      title: "Mirror fit",
      description: "Soft, relaxed fit",
      tags: ["mirror", "summer"],
      createdAt: "2024-06-01T00:00:00.000Z",
      importedAt: "2024-06-03T00:00:00.000Z",
      updatedAt: "2024-06-04T00:00:00.000Z",
      favorite: true,
      fitDate: "2024-06-02",
      linkedItemIds: ["top_1", "missing_1"],
      linkedItemUuids: ["uuid-top-1"],
      linkedItemNames: ["Lemaire Twisted Shirt", "Missing wardrobe item"],
      primaryImageUrl: "https://cdn.example.com/fitpic-1-original.jpg",
      imageCount: 2,
      imageUrls: ["https://cdn.example.com/fitpic-1-original.jpg", "/images/fitpic-1-alt.jpg"],
      futureImageLink: ""
    }
  );
});

test("fitpic export counts base64-only images without exporting base64 references", () => {
  assert.deepEqual(
    createFitpicExportRecord(
      {
        id: "fitpic_only_base64",
        fitpicUuid: "fitpic-only-base64",
        name: "Only base64",
        fitpicImages: [
          {
            fitpicImageUuid: "image-base64-1",
            imageData: "data:image/png;base64,one"
          },
          {
            fitpicImageUuid: "image-base64-2",
            imageData: "data:image/png;base64,two"
          }
        ]
      },
      items
    ),
    {
      id: "fitpic_only_base64",
      fitpicUuid: "fitpic-only-base64",
      title: "Only base64",
      description: "",
      tags: [],
      createdAt: "",
      importedAt: "",
      updatedAt: "",
      favorite: false,
      fitDate: "",
      linkedItemIds: [],
      linkedItemUuids: [],
      linkedItemNames: [],
      primaryImageUrl: "",
      imageCount: 2,
      imageUrls: [],
      futureImageLink: ""
    }
  );
});

test("fitpic export uses direct fitpic image path references when present", () => {
  const record = createFitpicExportRecord(
    {
      id: "fitpic_path",
      fitpicUuid: "fitpic-path",
      name: "Path ref",
      imageUrl: "/images/direct-fitpic.jpg",
      imageUrls: ["/images/direct-fitpic.jpg", "data:image/png;base64,discard"]
    },
    items
  );

  assert.equal(record.primaryImageUrl, "/images/direct-fitpic.jpg");
  assert.equal(record.imageCount, 1);
  assert.deepEqual(record.imageUrls, ["/images/direct-fitpic.jpg"]);
});

test("fitpic export falls back to sourceRelativePath references and respects primaryImageUuid", () => {
  const record = createFitpicExportRecord(
    {
      id: "fitpic_primary_uuid",
      fitpicUuid: "fitpic-primary-uuid",
      name: "Primary UUID",
      primaryImageUuid: "image-2",
      fitpicImages: [
        {
          fitpicImageUuid: "image-1",
          imageData: "data:image/png;base64,one",
          sourceRelativePath: "Front.jpg"
        },
        {
          fitpicImageUuid: "image-2",
          imageData: "data:image/png;base64,two",
          sourceRelativePath: "Detail.jpg"
        }
      ]
    },
    items
  );

  assert.equal(record.primaryImageUrl, "Detail.jpg");
  assert.equal(record.imageCount, 2);
  assert.deepEqual(record.imageUrls, ["Detail.jpg", "Front.jpg"]);
});

test("saved outfits csv escapes commas quotes and line breaks", () => {
  const csv = serializeSavedOutfitsCsv([
    {
      id: "saved_4",
      outfitUuid: "outfit-uuid-4",
      name: "Quoted",
      description: "hello,\n\"there\"",
      tags: ["one", "two"],
      outfit: {},
      outfitItemUuids: {}
    }
  ], items);

  assert.equal(csv.startsWith(`${SAVED_OUTFIT_EXPORT_COLUMNS.join(",")}\n`), true);
  assert.equal(csv.includes("\"hello,\n\"\"there\"\"\""), true);
  assert.equal(csv.includes(",one|two,"), true);
});

test("fitpics csv uses stable header and excludes base64 payloads", () => {
  const csv = serializeFitpicsCsv([
    {
      id: "fitpic_2",
      fitpicUuid: "fitpic-uuid-2",
      name: "One image",
      fitpicImages: [
        {
          fitpicImageUuid: "fitpic-image-3",
          images: {
            preview: "data:image/png;base64,discard"
          }
        }
      ]
    }
  ], items);

  const rows = csv.split("\n");
  assert.equal(rows[0], FITPIC_EXPORT_COLUMNS.join(","));
  assert.equal(rows[1].includes("data:image"), false);
  assert.equal(rows[1].endsWith(",,,1,,"), true);
});

test("json serializers preserve structured metadata arrays", () => {
  const savedJson = JSON.parse(serializeSavedOutfitsJson([
    {
      id: "saved_5",
      outfitUuid: "outfit-uuid-5",
      name: "Accessories",
      tags: ["one"],
      outfit: { Glasses: "head_1" },
      outfitItemUuids: { Glasses: "uuid-head-1" }
    }
  ], items));
  const fitpicJson = JSON.parse(serializeFitpicsJson([
    {
      id: "fitpic_3",
      fitpicUuid: "fitpic-uuid-3",
      name: "JSON",
      tags: ["editorial"],
      fitpicImages: [
        {
          fitpicImageUuid: "fitpic-image-4",
          images: {
            original: "/images/json-fitpic.jpg"
          }
        }
      ]
    }
  ], items));

  assert.deepEqual(savedJson[0].tags, ["one"]);
  assert.deepEqual(savedJson[0].accessories, [
    {
      slot: "Glasses",
      itemId: "head_1",
      itemUuid: "uuid-head-1",
      itemName: "Kapital Watch Cap"
    }
  ]);
  assert.deepEqual(fitpicJson[0].tags, ["editorial"]);
  assert.deepEqual(fitpicJson[0].imageUrls, ["/images/json-fitpic.jpg"]);
});

test("helpers sanitize image references and escape csv cells", () => {
  assert.equal(sanitizeImageReference(" data:image/png;base64,abc "), "");
  assert.equal(sanitizeImageReference(" /images/example.png "), "/images/example.png");
  assert.equal(escapeCsvCell("hello"), "hello");
  assert.equal(escapeCsvCell("a,\"b\""), "\"a,\"\"b\"\"\"");
});
