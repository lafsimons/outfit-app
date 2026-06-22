import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  LEGACY_PACKAGE_ASSET_POLICY,
  PACKAGE_APP_STATE_FILE,
  PACKAGE_ASSET_POLICY,
  PACKAGE_FITPICS_FILE,
  PACKAGE_FITPIC_PREVIEWS_DIR,
  PACKAGE_FORMAT,
  PACKAGE_MANIFEST_FILE,
  PACKAGE_SAVED_OUTFITS_FILE,
  PACKAGE_SOURCE,
  PACKAGE_VERSION,
  PACKAGE_WARDROBE_ITEMS_FILE,
  PACKAGE_WARDROBE_PREVIEWS_DIR,
  PACKAGE_WARNINGS_FILE,
  buildBackupPackage,
  buildBackupPackageManifest,
  buildBackupPackageZip,
  findEmbeddedDataImagePaths,
  importBackupPackage,
  validateBackupPackageManifest
} from "./backupPackageV2.js";

test("buildBackupPackageManifest returns the expected manifest", () => {
  const manifest = buildBackupPackageManifest({
    exportedAt: "2026-06-13T12:00:00.000Z",
    wardrobeItemCount: 2,
    fitpicCount: 3,
    savedOutfitCount: 4,
    wardrobePreviewFileCount: 5,
    fitpicPreviewFileCount: 6
  });

  assert.deepEqual(manifest, {
    source: PACKAGE_SOURCE,
    version: PACKAGE_VERSION,
    exportedAt: "2026-06-13T12:00:00.000Z",
    format: PACKAGE_FORMAT,
    assetPolicy: PACKAGE_ASSET_POLICY,
    wardrobeItemCount: 2,
    fitpicCount: 3,
    savedOutfitCount: 4,
    wardrobePreviewFileCount: 5,
    fitpicPreviewFileCount: 6,
    files: {
      appState: PACKAGE_APP_STATE_FILE,
      wardrobeItems: PACKAGE_WARDROBE_ITEMS_FILE,
      fitpics: PACKAGE_FITPICS_FILE,
      savedOutfits: PACKAGE_SAVED_OUTFITS_FILE,
      wardrobePreviewsDir: PACKAGE_WARDROBE_PREVIEWS_DIR,
      fitpicPreviewsDir: PACKAGE_FITPIC_PREVIEWS_DIR
    }
  });
  assert.equal(validateBackupPackageManifest(manifest), manifest);
});

test("buildBackupPackage extracts wardrobe preview assets and strips embedded media", async () => {
  const result = await buildBackupPackage({
    items: [
      {
        id: "item-1",
        itemUuid: "item-uuid-1",
        imageUrl: "data:image/png;base64,Zm9v",
        images: {
          original: { src: "" },
          preview: { src: "data:image/png;base64,Zm9v", mimeType: "image/png", width: 120, height: 160 },
          thumbnail: { src: "data:image/png;base64,Zm9v", mimeType: "image/png", width: 60, height: 80 }
        },
        activeItemImageUuid: "item-image-1",
        itemImages: [
          {
            itemImageUuid: "item-image-1",
            parentItemUuid: "item-uuid-1",
            order: 0,
            canonicalAsset: {
              assetUuid: "asset-1",
              kind: "canonical",
              parentItemImageUuid: "item-image-1",
              order: 0,
              imageUrl: "data:image/png;base64,Zm9v",
              images: {
                original: { src: "" },
                preview: { src: "data:image/png;base64,Zm9v", mimeType: "image/png", width: 120, height: 160 },
                thumbnail: { src: "data:image/png;base64,Zm9v", mimeType: "image/png", width: 60, height: 80 }
              }
            },
            derivedAssets: [
              {
                assetUuid: "asset-2",
                kind: "derived",
                parentItemImageUuid: "item-image-1",
                order: 1,
                imageUrl: "data:image/webp;base64,YmFy",
                images: {
                  original: { src: "" },
                  preview: { src: "data:image/webp;base64,YmFy", mimeType: "image/webp", width: 120, height: 160 },
                  thumbnail: { src: "data:image/webp;base64,YmFy", mimeType: "image/webp", width: 60, height: 80 }
                }
              }
            ],
            activeImageAssetUuid: "asset-2"
          }
        ]
      }
    ],
    appState: {
      savedOutfits: [],
      fitpics: [],
      recentOutfits: ["ignore-me"]
    }
  });

  const manifest = JSON.parse(strFromU8(result.files.get(PACKAGE_MANIFEST_FILE)));
  const appState = JSON.parse(strFromU8(result.files.get(PACKAGE_APP_STATE_FILE)));
  const [wardrobeRecord] = strFromU8(result.files.get(PACKAGE_WARDROBE_ITEMS_FILE))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(manifest.wardrobeItemCount, 1);
  assert.equal(manifest.wardrobePreviewFileCount, 2);
  assert.equal("recentOutfits" in appState, false);
  assert.equal(wardrobeRecord.imageUrl, "");
  assert.equal(wardrobeRecord.images.preview.src, "");
  assert.equal(
    wardrobeRecord.images.preview.packagePath,
    `${PACKAGE_WARDROBE_PREVIEWS_DIR}/asset-2.webp`
  );
  assert.equal(
    wardrobeRecord.itemImages[0].canonicalAsset.images.preview.packagePath,
    `${PACKAGE_WARDROBE_PREVIEWS_DIR}/asset-1.png`
  );
  assert.equal(
    wardrobeRecord.itemImages[0].derivedAssets[0].images.preview.packagePath,
    `${PACKAGE_WARDROBE_PREVIEWS_DIR}/asset-2.webp`
  );
  assert.equal(JSON.stringify(wardrobeRecord).includes("data:image/"), false);
  assert.equal(result.files.has(`${PACKAGE_WARDROBE_PREVIEWS_DIR}/asset-1.png`), true);
  assert.equal(result.files.has(`${PACKAGE_WARDROBE_PREVIEWS_DIR}/asset-2.webp`), true);
});

test("buildBackupPackage strips nested legacy wardrobe item-image payload mirrors after extraction", async () => {
  const result = await buildBackupPackage({
    items: [
      {
        id: "accessory_bag_backpack_salomon_xt_15_os_black",
        itemUuid: "item-uuid-bag-1",
        imageUrl: "data:image/png;base64,Zm9v",
        images: {
          original: { src: "data:image/png;base64,b3JpZw==" },
          preview: { src: "data:image/png;base64,Zm9v", mimeType: "image/png", width: 120, height: 160 },
          thumbnail: { src: "data:image/png;base64,dGh1bWI=", mimeType: "image/png", width: 60, height: 80 }
        },
        activeItemImageUuid: "item-image-bag-1",
        itemImages: [
          {
            itemImageUuid: "item-image-bag-1",
            parentItemUuid: "item-uuid-bag-1",
            order: 0,
            imageData: "data:image/png;base64,aXRlbS1pbWFnZS1kYXRh",
            imageUrl: "data:image/png;base64,aXRlbS1pbWFnZS11cmw=",
            src: "data:image/png;base64,aXRlbS1pbWFnZS1zcmM=",
            dataUrl: "data:image/png;base64,aXRlbS1pbWFnZS1kYXRhLXVybA==",
            images: {
              original: { src: "data:image/png;base64,aXRlbS1pbWFnZS1vcmln" },
              preview: { src: "data:image/png;base64,aXRlbS1pbWFnZS1wcmV2", mimeType: "image/png" },
              thumbnail: { src: "data:image/png;base64,aXRlbS1pbWFnZS10aHVtYg==", mimeType: "image/png" }
            },
            canonicalAsset: {
              assetUuid: "asset-bag-1",
              kind: "canonical",
              parentItemImageUuid: "item-image-bag-1",
              order: 0,
              imageUrl: "data:image/png;base64,Y2Fub25pY2FsLXVybA==",
              src: "data:image/png;base64,Y2Fub25pY2FsLXNyYw==",
              dataUrl: "data:image/png;base64,Y2Fub25pY2FsLWRhdGF1cmw=",
              imageData: "data:image/png;base64,Y2Fub25pY2FsLWltYWdlRGF0YQ==",
              images: {
                original: { src: "data:image/png;base64,Y2Fub25pY2FsLW9yaWc=" },
                preview: { src: "data:image/png;base64,Y2Fub25pY2FsLXByZXY=", mimeType: "image/png", width: 120, height: 160 },
                thumbnail: { src: "data:image/png;base64,Y2Fub25pY2FsLXRodW1i", mimeType: "image/png", width: 60, height: 80 }
              }
            },
            derivedAssets: [
              {
                assetUuid: "asset-bag-2",
                kind: "derived",
                parentItemImageUuid: "item-image-bag-1",
                order: 1,
                src: "data:image/webp;base64,ZGVyaXZlZC1zcmM=",
                dataUrl: "data:image/webp;base64,ZGVyaXZlZC1kYXRhLXVybA==",
                imageData: "data:image/webp;base64,ZGVyaXZlZC1pbWFnZS1kYXRh",
                imageUrl: "data:image/webp;base64,ZGVyaXZlZC11cmw=",
                images: {
                  original: { src: "data:image/webp;base64,ZGVyaXZlZC1vcmln" },
                  preview: { src: "data:image/webp;base64,ZGVyaXZlZC1wcmV2", mimeType: "image/webp", width: 120, height: 160 },
                  thumbnail: { src: "data:image/webp;base64,ZGVyaXZlZC10aHVtYg==", mimeType: "image/webp", width: 60, height: 80 }
                }
              }
            ],
            activeImageAssetUuid: "asset-bag-2"
          }
        ]
      }
    ],
    appState: {
      savedOutfits: [],
      fitpics: []
    }
  });

  const [wardrobeRecord] = strFromU8(result.files.get(PACKAGE_WARDROBE_ITEMS_FILE))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.deepEqual(findEmbeddedDataImagePaths(wardrobeRecord), []);
  assert.equal(wardrobeRecord.itemImages[0].imageData, "");
  assert.equal(wardrobeRecord.itemImages[0].imageUrl, "");
  assert.equal(wardrobeRecord.itemImages[0].src, "");
  assert.equal(wardrobeRecord.itemImages[0].dataUrl, "");
  assert.equal(wardrobeRecord.itemImages[0].images.preview.src, "");
  assert.equal(wardrobeRecord.itemImages[0].canonicalAsset.src, "");
  assert.equal(wardrobeRecord.itemImages[0].canonicalAsset.dataUrl, "");
  assert.equal(wardrobeRecord.itemImages[0].canonicalAsset.imageData, "");
  assert.equal(wardrobeRecord.itemImages[0].derivedAssets[0].src, "");
  assert.equal(wardrobeRecord.itemImages[0].derivedAssets[0].dataUrl, "");
  assert.equal(wardrobeRecord.itemImages[0].derivedAssets[0].imageData, "");
  assert.equal(
    wardrobeRecord.itemImages[0].canonicalAsset.images.preview.packagePath,
    `${PACKAGE_WARDROBE_PREVIEWS_DIR}/asset-bag-1.png`
  );
  assert.equal(
    wardrobeRecord.itemImages[0].derivedAssets[0].images.preview.packagePath,
    `${PACKAGE_WARDROBE_PREVIEWS_DIR}/asset-bag-2.webp`
  );
});

test("buildBackupPackage exports legacy wardrobe asset mirrors without warning when preview fields are missing", async () => {
  const result = await buildBackupPackage({
    items: [
      {
        id: "legacy-item",
        itemUuid: "legacy-item-uuid",
        imageUrl: "",
        images: {
          original: { src: "", mimeType: "image/png" },
          preview: { src: "", mimeType: "image/png" },
          thumbnail: { src: "", mimeType: "image/png" }
        },
        activeItemImageUuid: "legacy-item-image",
        itemImages: [
          {
            itemImageUuid: "legacy-item-image",
            parentItemUuid: "legacy-item-uuid",
            order: 0,
            canonicalAsset: {
              assetUuid: "legacy-asset",
              kind: "canonical",
              parentItemImageUuid: "legacy-item-image",
              order: 0,
              imageUrl: "",
              src: "data:image/png;base64,bGVnYWN5LXNyYw==",
              dataUrl: "data:image/png;base64,bGVnYWN5LWRhdGE=",
              imageData: "data:image/png;base64,bGVnYWN5LWltYWdl",
              images: {
                original: { src: "", mimeType: "image/png" },
                preview: { src: "", mimeType: "image/png" },
                thumbnail: { src: "", mimeType: "image/png" }
              }
            },
            derivedAssets: [],
            activeImageAssetUuid: "legacy-asset"
          }
        ]
      }
    ],
    appState: {
      savedOutfits: [],
      fitpics: []
    }
  });

  const [wardrobeRecord] = strFromU8(result.files.get(PACKAGE_WARDROBE_ITEMS_FILE))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(result.warningCount, 0);
  assert.equal(result.files.has(`${PACKAGE_WARDROBE_PREVIEWS_DIR}/legacy-asset.png`), true);
  assert.equal(
    wardrobeRecord.itemImages[0].canonicalAsset.images.preview.packagePath,
    `${PACKAGE_WARDROBE_PREVIEWS_DIR}/legacy-asset.png`
  );
  assert.equal(
    wardrobeRecord.itemImages[0].canonicalAsset.images.display.packagePath,
    `${PACKAGE_WARDROBE_PREVIEWS_DIR}/legacy-asset.png`
  );
});

test("buildBackupPackage extracts fitpic previews and preserves primary image identity", async () => {
  const result = await buildBackupPackage({
    items: [],
    appState: {
      savedOutfits: [],
      fitpics: [
        {
          id: "fitpic-1",
          fitpicUuid: "fitpic-uuid-1",
          name: "Fitpic",
          imageData: "data:image/png;base64,cHJpbWFyeQ==",
          images: {
            preview: "data:image/png;base64,cHJpbWFyeQ==",
            original: "",
            thumbnail: ""
          },
          primaryImageUuid: "fitpic-image-2",
          fitpicImages: [
            {
              fitpicImageUuid: "fitpic-image-1",
              parentFitpicUuid: "fitpic-uuid-1",
              order: 0,
              imageData: "data:image/png;base64,c2Vjb25kYXJ5",
              images: {
                preview: "data:image/png;base64,c2Vjb25kYXJ5",
                original: "",
                thumbnail: ""
              },
              sourceMimeType: "image/png",
              sourceOriginalFilename: "secondary.png"
            },
            {
              fitpicImageUuid: "fitpic-image-2",
              parentFitpicUuid: "fitpic-uuid-1",
              order: 1,
              imageData: "data:image/webp;base64,cHJpbWFyeQ==",
              images: {
                preview: "data:image/webp;base64,cHJpbWFyeQ==",
                original: "",
                thumbnail: ""
              },
              sourceMimeType: "image/webp",
              sourceOriginalFilename: "primary.webp"
            }
          ]
        }
      ]
    }
  });

  const [fitpicRecord] = strFromU8(result.files.get(PACKAGE_FITPICS_FILE))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(fitpicRecord.primaryImageUuid, "fitpic-image-2");
  assert.equal(fitpicRecord.imageData, "");
  assert.equal(
    fitpicRecord.images.preview.packagePath,
    `${PACKAGE_FITPIC_PREVIEWS_DIR}/fitpic-image-2.webp`
  );
  assert.equal(
    fitpicRecord.fitpicImages[0].images.preview.packagePath,
    `${PACKAGE_FITPIC_PREVIEWS_DIR}/fitpic-image-1.png`
  );
  assert.equal(
    fitpicRecord.fitpicImages[1].images.preview.packagePath,
    `${PACKAGE_FITPIC_PREVIEWS_DIR}/fitpic-image-2.webp`
  );
  assert.equal(JSON.stringify(fitpicRecord).includes("data:image/"), false);
  assert.equal(result.files.has(`${PACKAGE_FITPIC_PREVIEWS_DIR}/fitpic-image-1.png`), true);
  assert.equal(result.files.has(`${PACKAGE_FITPIC_PREVIEWS_DIR}/fitpic-image-2.webp`), true);
});

test("buildBackupPackage exports saved outfits separately and omits warnings when not needed", async () => {
  const result = await buildBackupPackage({
    items: [],
    appState: {
      savedOutfits: [
        {
          id: "saved-1",
          outfitUuid: "outfit-uuid-1",
          name: "Saved outfit",
          outfit: { TopInner: "item-1" },
          outfitItemUuids: { TopInner: "item-uuid-1" },
          layering: false
        }
      ],
      fitpics: [],
      wardrobeSort: "newest"
    }
  });

  const appState = JSON.parse(strFromU8(result.files.get(PACKAGE_APP_STATE_FILE)));
  const [savedOutfitRecord] = strFromU8(result.files.get(PACKAGE_SAVED_OUTFITS_FILE))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal("savedOutfits" in appState, false);
  assert.equal(savedOutfitRecord.outfitUuid, "outfit-uuid-1");
  assert.equal(result.warningCount, 0);
  assert.equal(result.files.has(PACKAGE_WARNINGS_FILE), false);
});

test("buildBackupPackage emits warnings only when preview payloads are unrecoverable", async () => {
  const result = await buildBackupPackage({
    items: [
      {
        id: "item-missing",
        itemUuid: "item-uuid-missing",
        imageUrl: "",
        images: {
          preview: { src: "", mimeType: "image/png" },
          thumbnail: { src: "", mimeType: "image/png" },
          original: { src: "", mimeType: "image/png" }
        },
        itemImages: [
          {
            itemImageUuid: "item-image-missing",
            parentItemUuid: "item-uuid-missing",
            order: 0,
            canonicalAsset: {
              assetUuid: "asset-missing",
              kind: "canonical",
              parentItemImageUuid: "item-image-missing",
              order: 0,
              imageUrl: "",
              images: {
                preview: { src: "", mimeType: "image/png" },
                thumbnail: { src: "", mimeType: "image/png" },
                original: { src: "", mimeType: "image/png" }
              }
            },
            derivedAssets: [],
            activeImageAssetUuid: "asset-missing"
          }
        ]
      }
    ],
    appState: {
      fitpics: [],
      savedOutfits: []
    }
  });

  const [wardrobeRecord] = strFromU8(result.files.get(PACKAGE_WARDROBE_ITEMS_FILE))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const warningReport = JSON.parse(strFromU8(result.files.get(PACKAGE_WARNINGS_FILE)));

  assert.equal(result.warningCount, 1);
  assert.equal(warningReport.warningCount, 1);
  assert.equal(wardrobeRecord.images.preview.src, "");
  assert.equal("packagePath" in wardrobeRecord.images.preview, false);
  assert.equal(JSON.stringify(wardrobeRecord).includes("data:image/"), false);
});

test("buildBackupPackageZip wraps the unchanged package structure into a zip", async () => {
  const result = await buildBackupPackageZip({
    items: [
      {
        id: "item-1",
        itemUuid: "item-uuid-1",
        imageUrl: "data:image/png;base64,Zm9v",
        images: {
          preview: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" },
          thumbnail: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" },
          original: { src: "", mimeType: "image/png" }
        },
        itemImages: [
          {
            itemImageUuid: "item-image-1",
            parentItemUuid: "item-uuid-1",
            order: 0,
            canonicalAsset: {
              assetUuid: "asset-1",
              kind: "canonical",
              parentItemImageUuid: "item-image-1",
              order: 0,
              imageUrl: "data:image/png;base64,Zm9v",
              images: {
                preview: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" },
                thumbnail: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" },
                original: { src: "", mimeType: "image/png" }
              }
            },
            derivedAssets: [],
            activeImageAssetUuid: "asset-1"
          }
        ]
      }
    ],
    appState: {
      savedOutfits: [],
      fitpics: []
    }
  });

  assert.equal(result.fileName, `oa-backup-v2-${result.exportedAt.slice(0, 10)}.zip`);

  const zipEntries = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));

  [
    PACKAGE_MANIFEST_FILE,
    PACKAGE_APP_STATE_FILE,
    PACKAGE_WARDROBE_ITEMS_FILE,
    PACKAGE_FITPICS_FILE,
    PACKAGE_SAVED_OUTFITS_FILE,
    `${PACKAGE_WARDROBE_PREVIEWS_DIR}/asset-1.png`
  ].forEach((path) => {
    assert.equal(path in zipEntries, true);
  });

  const zipManifest = JSON.parse(strFromU8(zipEntries[PACKAGE_MANIFEST_FILE]));
  assert.equal(zipManifest.wardrobeItemCount, 1);
});

test("importBackupPackage restores wardrobe originals display thumbnails and fitpics from a backup zip", async () => {
  const wardrobeOriginal = "data:image/webp;base64,b3JpZ2luYWw=";
  const wardrobeDisplay = "data:image/webp;base64,ZGlzcGxheQ==";
  const wardrobeThumb = "data:image/webp;base64,dGh1bWI=";
  const fitpicOriginal = "data:image/webp;base64,Zml0cGljLW9yaWdpbmFs";
  const fitpicDisplay = "data:image/webp;base64,Zml0cGljLWRpc3BsYXk=";
  const fitpicThumb = "data:image/webp;base64,Zml0cGljLXRodW1i";
  const zipResult = await buildBackupPackageZip({
    items: [
      {
        id: "item-1",
        itemUuid: "item-uuid-1",
        imageUrl: wardrobeDisplay,
        images: {
          original: { src: wardrobeOriginal, mimeType: "image/webp" },
          display: { src: wardrobeDisplay, mimeType: "image/webp" },
          preview: { src: wardrobeDisplay, mimeType: "image/webp" },
          thumbnail: { src: wardrobeThumb, mimeType: "image/webp" }
        },
        originalPreserved: false,
        archivalOriginalPreserved: true,
        activeItemImageUuid: "item-image-1",
        itemImages: [
          {
            itemImageUuid: "item-image-1",
            parentItemUuid: "item-uuid-1",
            order: 0,
            canonicalAsset: {
              assetUuid: "asset-1",
              kind: "canonical",
              parentItemImageUuid: "item-image-1",
              order: 0,
              imageUrl: wardrobeDisplay,
              images: {
                original: { src: wardrobeOriginal, mimeType: "image/webp" },
                display: { src: wardrobeDisplay, mimeType: "image/webp" },
                preview: { src: wardrobeDisplay, mimeType: "image/webp" },
                thumbnail: { src: wardrobeThumb, mimeType: "image/webp" }
              },
              originalPreserved: false,
              archivalOriginalPreserved: true
            },
            derivedAssets: [],
            activeImageAssetUuid: "asset-1"
          }
        ]
      }
    ],
    appState: {
      savedOutfits: [
        {
          id: "saved-1",
          outfitUuid: "outfit-uuid-1",
          name: "Saved outfit",
          outfit: { TopInner: "item-1" },
          outfitItemUuids: { TopInner: "item-uuid-1" },
          layering: false
        }
      ],
      fitpics: [
        {
          id: "fitpic-1",
          fitpicUuid: "fitpic-uuid-1",
          name: "Fitpic",
          imageData: fitpicDisplay,
          images: {
            original: fitpicOriginal,
            display: fitpicDisplay,
            preview: fitpicDisplay,
            thumbnail: fitpicThumb
          },
          primaryImageUuid: "fitpic-image-1",
          fitpicImages: [
            {
              fitpicImageUuid: "fitpic-image-1",
              parentFitpicUuid: "fitpic-uuid-1",
              order: 0,
              imageData: fitpicDisplay,
              images: {
                original: fitpicOriginal,
                display: fitpicDisplay,
                preview: fitpicDisplay,
                thumbnail: fitpicThumb
              }
            }
          ]
        }
      ]
    }
  });

  const imported = await importBackupPackage({
    file: zipResult.blob
  });

  assert.equal(imported.backup.items[0].images.original.src.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.items[0].images.display.src.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.items[0].images.thumbnail.src.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.items[0].itemImages[0].canonicalAsset.images.original.src.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.appState.fitpics[0].images.original.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.appState.fitpics[0].images.display.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.appState.savedOutfits[0].outfitUuid, "outfit-uuid-1");
  assert.equal(imported.warnings.length, 0);
});

test("importBackupPackage rebuilds visible wardrobe aliases from original when display and preview are absent", async () => {
  const manifest = buildBackupPackageManifest({
    exportedAt: "2026-06-22T12:30:00.000Z",
    wardrobeItemCount: 1,
    fitpicCount: 0,
    savedOutfitCount: 0,
    wardrobePreviewFileCount: 1,
    fitpicPreviewFileCount: 0
  });
  const originalPath = `${PACKAGE_WARDROBE_PREVIEWS_DIR}/original-only-original.webp`;
  const zipBytes = zipSync({
    [PACKAGE_MANIFEST_FILE]: strToU8(JSON.stringify(manifest)),
    [PACKAGE_APP_STATE_FILE]: strToU8(JSON.stringify({ wardrobeSort: "newest" })),
    [PACKAGE_WARDROBE_ITEMS_FILE]: strToU8(`${JSON.stringify({
      id: "item-original-only",
      itemUuid: "item-original-only-uuid",
      imageUrl: "",
      images: {
        original: { src: "", mimeType: "image/webp", packagePath: originalPath },
        display: { src: "" },
        preview: { src: "" },
        thumbnail: { src: "" }
      },
      activeItemImageUuid: "item-image-original-only",
      itemImages: [
        {
          itemImageUuid: "item-image-original-only",
          parentItemUuid: "item-original-only-uuid",
          order: 0,
          canonicalAsset: {
            assetUuid: "asset-original-only",
            kind: "canonical",
            parentItemImageUuid: "item-image-original-only",
            order: 0,
            imageUrl: "",
            images: {
              original: { src: "", mimeType: "image/webp", packagePath: originalPath },
              display: { src: "" },
              preview: { src: "" },
              thumbnail: { src: "" }
            }
          },
          derivedAssets: [],
          activeImageAssetUuid: "asset-original-only"
        }
      ]
    })}\n`),
    [PACKAGE_FITPICS_FILE]: strToU8(""),
    [PACKAGE_SAVED_OUTFITS_FILE]: strToU8(""),
    [originalPath]: strToU8("original-only")
  });

  const imported = await importBackupPackage({
    file: new Blob([zipBytes], { type: "application/zip" })
  });

  assert.equal(imported.backup.items[0].images.original.src.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.items[0].images.display.src.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.items[0].images.preview.src.startsWith("data:image/webp;base64,"), true);
  assert.equal(imported.backup.items[0].imageUrl.startsWith("data:image/webp;base64,"), true);
  assert.equal(
    imported.backup.items[0].itemImages[0].canonicalAsset.imageUrl.startsWith("data:image/webp;base64,"),
    true
  );
});

test("importBackupPackage accepts legacy preview-only packages and warns on missing media without crashing", async () => {
  const legacyManifest = {
    source: PACKAGE_SOURCE,
    version: PACKAGE_VERSION,
    exportedAt: "2026-06-22T12:00:00.000Z",
    format: PACKAGE_FORMAT,
    assetPolicy: LEGACY_PACKAGE_ASSET_POLICY,
    wardrobeItemCount: 1,
    fitpicCount: 0,
    savedOutfitCount: 0,
    wardrobePreviewFileCount: 1,
    fitpicPreviewFileCount: 0,
    files: {
      appState: PACKAGE_APP_STATE_FILE,
      wardrobeItems: PACKAGE_WARDROBE_ITEMS_FILE,
      fitpics: PACKAGE_FITPICS_FILE,
      savedOutfits: PACKAGE_SAVED_OUTFITS_FILE,
      wardrobePreviewsDir: PACKAGE_WARDROBE_PREVIEWS_DIR,
      fitpicPreviewsDir: PACKAGE_FITPIC_PREVIEWS_DIR
    }
  };
  const legacyZip = zipSync({
    [PACKAGE_MANIFEST_FILE]: strToU8(JSON.stringify(legacyManifest)),
    [PACKAGE_APP_STATE_FILE]: strToU8(JSON.stringify({ wardrobeSort: "newest" })),
    [PACKAGE_WARDROBE_ITEMS_FILE]: strToU8(`${JSON.stringify({
      id: "item-1",
      itemUuid: "item-uuid-1",
      imageUrl: "",
      images: {
        original: { src: "" },
        preview: { src: "", packagePath: `${PACKAGE_WARDROBE_PREVIEWS_DIR}/missing-preview.webp` },
        thumbnail: { src: "" }
      },
      activeItemImageUuid: null,
      itemImages: []
    })}\n`),
    [PACKAGE_FITPICS_FILE]: strToU8(""),
    [PACKAGE_SAVED_OUTFITS_FILE]: strToU8("")
  });

  const imported = await importBackupPackage({
    file: new Blob([legacyZip], { type: "application/zip" })
  });

  assert.equal(imported.backup.items[0].images.display.src, "");
  assert.equal(imported.backup.items[0].images.preview.src, "");
  assert.equal(imported.warnings.length, 1);
});
