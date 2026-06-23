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
import { materializeFitpicsForRuntime } from "./fitpicMedia.js";
import { buildOaAiExportBundle } from "./oaAiExport.js";
import {
  listMediaRecordsForOwner,
  loadAppState,
  loadItems,
  replaceWithBackup,
  saveMediaRecord
} from "./storage.js";

class FakeIDBRequest {}

class FakeObjectStoreNames {
  constructor(stores) {
    this.stores = stores;
  }

  contains(name) {
    return this.stores.has(name);
  }
}

class FakeDatabase {
  constructor(state) {
    this.state = state;
    this.objectStoreNames = new FakeObjectStoreNames(state.stores);
  }

  createObjectStore(name, { keyPath }) {
    if (!this.state.stores.has(name)) {
      this.state.stores.set(name, {
        keyPath,
        records: new Map(),
        indexes: new Map()
      });
    }

    return {
      createIndex: (indexName, keyPathValue) => {
        this.state.stores.get(name).indexes.set(indexName, { keyPath: keyPathValue });
      }
    };
  }

  transaction(storeNames, mode) {
    return new FakeTransaction(this.state, storeNames, mode);
  }

  close() {}
}

class FakeTransaction {
  constructor(state, storeNames, mode) {
    this.state = state;
    this.mode = mode;
    this.error = null;
    this.oncomplete = null;
    this.onerror = null;
    this.pendingCount = 0;
    this.completed = false;
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];

    queueMicrotask(() => {
      this.maybeComplete();
    });
  }

  objectStore(name) {
    const store = this.state.stores.get(name);

    if (!store) {
      throw new Error(`Missing object store: ${name}`);
    }

    return new FakeObjectStore(this, store);
  }

  createRequest(run) {
    const request = new FakeIDBRequest();
    this.pendingCount += 1;

    queueMicrotask(() => {
      try {
        request.result = run();
        request.onsuccess?.();
      } catch (error) {
        request.error = error;
        this.error = error;
        request.onerror?.();
        this.onerror?.();
      } finally {
        this.pendingCount -= 1;
        this.maybeComplete();
      }
    });

    return request;
  }

  maybeComplete() {
    if (this.completed || this.error || this.pendingCount > 0) {
      return;
    }

    this.completed = true;
    queueMicrotask(() => {
      this.oncomplete?.();
    });
  }
}

class FakeObjectStore {
  constructor(transaction, store) {
    this.transaction = transaction;
    this.store = store;
  }

  get(key) {
    return this.transaction.createRequest(() => {
      const value = this.store.records.get(key);
      return value === undefined ? undefined : structuredClone(value);
    });
  }

  put(value) {
    return this.transaction.createRequest(() => {
      const key = value?.[this.store.keyPath];

      if (key === undefined) {
        throw new Error(`Missing keyPath value for ${this.store.keyPath}`);
      }

      this.store.records.set(key, structuredClone(value));
      return key;
    });
  }

  getAll() {
    return this.transaction.createRequest(() =>
      [...this.store.records.values()].map((value) => structuredClone(value))
    );
  }

  clear() {
    return this.transaction.createRequest(() => {
      this.store.records.clear();
      return undefined;
    });
  }

  delete(key) {
    return this.transaction.createRequest(() => {
      this.store.records.delete(key);
      return undefined;
    });
  }

  index(indexName) {
    const indexDefinition = this.store.indexes.get(indexName);

    if (!indexDefinition) {
      throw new Error(`Missing index: ${indexName}`);
    }

    return {
      getAll: (expectedValue) =>
        this.transaction.createRequest(() =>
          [...this.store.records.values()]
            .filter((record) => record?.[indexDefinition.keyPath] === expectedValue)
            .map((record) => structuredClone(record))
        )
    };
  }
}

class FakeIndexedDB {
  constructor() {
    this.databases = new Map();
  }

  open(name, version) {
    const request = new FakeIDBRequest();

    queueMicrotask(() => {
      const existingState = this.databases.get(name);

      if (!existingState) {
        const nextState = {
          version: version ?? 1,
          stores: new Map()
        };
        this.databases.set(name, nextState);
        request.result = new FakeDatabase(nextState);
        request.onupgradeneeded?.();
        request.onsuccess?.();
        return;
      }

      const nextVersion = version ?? existingState.version;

      if (nextVersion < existingState.version) {
        request.error = new Error("VersionError");
        request.onerror?.();
        return;
      }

      if (nextVersion > existingState.version) {
        existingState.version = nextVersion;
        request.result = new FakeDatabase(existingState);
        request.onupgradeneeded?.();
        request.onsuccess?.();
        return;
      }

      request.result = new FakeDatabase(existingState);
      request.onsuccess?.();
    });

    return request;
  }
}

test.beforeEach(() => {
  globalThis.indexedDB = new FakeIndexedDB();
  globalThis.IDBRequest = FakeIDBRequest;
});

async function seedFitpicMediaFixture({
  fitpicImageUuid = "fitpic-image-restore-1",
  createdAt = "2026-06-23T12:00:00.000Z"
} = {}) {
  await saveMediaRecord({
    mediaId: `fitpicImage:${fitpicImageUuid}:original`,
    ownerType: "fitpicImage",
    ownerId: fitpicImageUuid,
    variant: "original",
    blob: new Blob(["original-bytes"], { type: "image/webp" }),
    mimeType: "image/webp",
    fileSize: 14,
    width: 2000,
    height: 2600,
    createdAt,
    updatedAt: createdAt,
    sourceKind: "test"
  });
  await saveMediaRecord({
    mediaId: `fitpicImage:${fitpicImageUuid}:display`,
    ownerType: "fitpicImage",
    ownerId: fitpicImageUuid,
    variant: "display",
    blob: new Blob(["display-bytes"], { type: "image/webp" }),
    mimeType: "image/webp",
    fileSize: 13,
    width: 1200,
    height: 1600,
    createdAt,
    updatedAt: createdAt,
    sourceKind: "test"
  });
  await saveMediaRecord({
    mediaId: `fitpicImage:${fitpicImageUuid}:thumbnail`,
    ownerType: "fitpicImage",
    ownerId: fitpicImageUuid,
    variant: "thumbnail",
    blob: new Blob(["thumb-bytes"], { type: "image/webp" }),
    mimeType: "image/webp",
    fileSize: 11,
    width: 320,
    height: 427,
    createdAt,
    updatedAt: createdAt,
    sourceKind: "test"
  });
}

function createFitpicRefFixture({
  fitpicId = "fitpic-restore-1",
  fitpicUuid = "fitpic-uuid-restore-1",
  fitpicImageUuid = "fitpic-image-restore-1"
} = {}) {
  return {
    id: fitpicId,
    fitpicUuid,
    name: "Restored fitpic",
    imageData: "",
    images: {
      original: {
        mediaId: `fitpicImage:${fitpicImageUuid}:original`,
        mimeType: "image/webp",
        fileSize: 14,
        width: 2000,
        height: 2600
      },
      display: {
        mediaId: `fitpicImage:${fitpicImageUuid}:display`,
        mimeType: "image/webp",
        fileSize: 13,
        width: 1200,
        height: 1600
      },
      preview: {
        mediaId: `fitpicImage:${fitpicImageUuid}:display`,
        mimeType: "image/webp",
        fileSize: 13,
        width: 1200,
        height: 1600
      },
      thumbnail: {
        mediaId: `fitpicImage:${fitpicImageUuid}:thumbnail`,
        mimeType: "image/webp",
        fileSize: 11,
        width: 320,
        height: 427
      }
    },
    primaryImageUuid: fitpicImageUuid,
    fitpicImages: [
      {
        fitpicImageUuid,
        parentFitpicUuid: fitpicUuid,
        order: 0,
        imageData: "",
        images: {
          original: {
            mediaId: `fitpicImage:${fitpicImageUuid}:original`,
            mimeType: "image/webp",
            fileSize: 14,
            width: 2000,
            height: 2600
          },
          display: {
            mediaId: `fitpicImage:${fitpicImageUuid}:display`,
            mimeType: "image/webp",
            fileSize: 13,
            width: 1200,
            height: 1600
          },
          preview: {
            mediaId: `fitpicImage:${fitpicImageUuid}:display`,
            mimeType: "image/webp",
            fileSize: 13,
            width: 1200,
            height: 1600
          },
          thumbnail: {
            mediaId: `fitpicImage:${fitpicImageUuid}:thumbnail`,
            mimeType: "image/webp",
            fileSize: 11,
            width: 320,
            height: 427
          }
        },
        sourceMimeType: "image/webp",
        sourceOriginalFilename: "restored-fitpic.webp",
        importedAt: "2026-06-23T12:00:00.000Z"
      }
    ]
  };
}

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

test("buildBackupPackage exports fitpic media-store refs without fitpic warnings", async () => {
  await saveMediaRecord({
    mediaId: "fitpicImage:fitpic-image-ref:display",
    ownerType: "fitpicImage",
    ownerId: "fitpic-image-ref",
    variant: "display",
    blob: new Blob(["display-bytes"], { type: "image/webp" }),
    mimeType: "image/webp",
    fileSize: 13,
    width: 1200,
    height: 1600,
    createdAt: "2026-06-23T12:00:00.000Z",
    updatedAt: "2026-06-23T12:00:00.000Z",
    sourceKind: "test"
  });

  const result = await buildBackupPackage({
    items: [],
    appState: {
      savedOutfits: [],
      fitpics: [
        {
          id: "fitpic-ref",
          fitpicUuid: "fitpic-uuid-ref",
          name: "Ref only",
          imageData: "",
          primaryImageUuid: "fitpic-image-ref",
          fitpicImages: [
            {
              fitpicImageUuid: "fitpic-image-ref",
              parentFitpicUuid: "fitpic-uuid-ref",
              order: 0,
              imageData: "",
              images: {
                original: "",
                display: {
                  mediaId: "fitpicImage:fitpic-image-ref:display",
                  mimeType: "image/webp",
                  fileSize: 13,
                  width: 1200,
                  height: 1600
                },
                preview: {
                  mediaId: "fitpicImage:fitpic-image-ref:display",
                  mimeType: "image/webp",
                  fileSize: 13,
                  width: 1200,
                  height: 1600
                },
                thumbnail: ""
              }
            }
          ]
        }
      ]
    }
  });

  const fitpicWarnings = result.warnings.filter((warning) => warning.entityType === "oaFitpicImage");
  const [fitpicRecord] = strFromU8(result.files.get(PACKAGE_FITPICS_FILE))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(fitpicWarnings.length, 0);
  assert.equal(result.files.has(`${PACKAGE_FITPIC_PREVIEWS_DIR}/fitpic-image-ref.webp`), true);
  assert.equal(
    fitpicRecord.fitpicImages[0].images.display.packagePath,
    `${PACKAGE_FITPIC_PREVIEWS_DIR}/fitpic-image-ref.webp`
  );
  assert.equal(
    fitpicRecord.fitpicImages[0].images.preview.packagePath,
    `${PACKAGE_FITPIC_PREVIEWS_DIR}/fitpic-image-ref.webp`
  );
});

test("Backup v2 restore persistence roundtrip keeps fitpic refs in appState and restores media records", async () => {
  await seedFitpicMediaFixture();

  const zipResult = await buildBackupPackageZip({
    items: [
      {
        id: "item-restore-1",
        itemUuid: "item-uuid-restore-1",
        name: "Restore item",
        imageUrl: "data:image/png;base64,Zm9v",
        images: {
          original: { src: "", mimeType: "image/png" },
          display: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" },
          preview: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" },
          thumbnail: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" }
        },
        activeItemImageUuid: "item-image-restore-1",
        itemImages: [
          {
            itemImageUuid: "item-image-restore-1",
            parentItemUuid: "item-uuid-restore-1",
            order: 0,
            canonicalAsset: {
              assetUuid: "asset-restore-1",
              kind: "canonical",
              parentItemImageUuid: "item-image-restore-1",
              order: 0,
              imageUrl: "data:image/png;base64,Zm9v",
              images: {
                original: { src: "", mimeType: "image/png" },
                display: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" },
                preview: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" },
                thumbnail: { src: "data:image/png;base64,Zm9v", mimeType: "image/png" }
              }
            },
            derivedAssets: [],
            activeImageAssetUuid: "asset-restore-1"
          }
        ]
      }
    ],
    appState: {
      savedOutfits: [],
      fitpics: [createFitpicRefFixture()]
    }
  });

  const imported = await importBackupPackage({
    file: zipResult.blob
  });

  await replaceWithBackup(imported.backup);

  const loadedItems = await loadItems();
  const persistedAppState = await loadAppState();
  const fitpicMediaRecords = await listMediaRecordsForOwner("fitpicImage", "fitpic-image-restore-1");
  const persistedJson = JSON.stringify(persistedAppState);

  assert.equal(loadedItems.length, 1);
  assert.equal(persistedAppState.fitpics.length, 1);
  assert.equal(persistedAppState.fitpics[0].imageData, "");
  assert.equal(persistedAppState.fitpics[0].images.display.mediaId, "fitpicImage:fitpic-image-restore-1:display");
  assert.equal(persistedAppState.fitpics[0].fitpicImages[0].imageData, "");
  assert.equal(persistedAppState.fitpics[0].fitpicImages[0].images.preview.mediaId, "fitpicImage:fitpic-image-restore-1:display");
  assert.equal(fitpicMediaRecords.length, 3);
  assert.equal(persistedJson.includes("data:image/"), false);
});

test("runtime rematerialization after Backup v2 restore resolves fitpic media store sources without repersisting inline payloads", async () => {
  await seedFitpicMediaFixture();

  const zipResult = await buildBackupPackageZip({
    items: [],
    appState: {
      savedOutfits: [],
      fitpics: [createFitpicRefFixture()]
    }
  });

  const imported = await importBackupPackage({
    file: zipResult.blob
  });

  await replaceWithBackup(imported.backup);

  const persistedAppState = await loadAppState();
  const runtimeFitpics = await materializeFitpicsForRuntime(persistedAppState.fitpics);
  const persistedJsonAfterMaterialize = JSON.stringify(await loadAppState());

  assert.equal(runtimeFitpics.length, 1);
  assert.equal(runtimeFitpics[0].fitpicImages[0].imageData.startsWith("blob:"), true);
  assert.equal(runtimeFitpics[0].imageData.startsWith("blob:"), true);
  assert.equal(persistedJsonAfterMaterialize.includes("data:image/"), false);
  assert.equal((await loadAppState()).fitpics[0].imageData, "");
});

test("OA AI export completes after Backup v2 restore and fitpic rematerialization", async () => {
  await seedFitpicMediaFixture();

  const zipResult = await buildBackupPackageZip({
    items: [],
    appState: {
      savedOutfits: [],
      fitpics: [createFitpicRefFixture()]
    }
  });

  const imported = await importBackupPackage({
    file: zipResult.blob
  });

  await replaceWithBackup(imported.backup);

  const persistedAppState = await loadAppState();
  const runtimeFitpics = await materializeFitpicsForRuntime(persistedAppState.fitpics);
  const bundle = await buildOaAiExportBundle({
    items: [],
    savedOutfits: [],
    fitpics: runtimeFitpics,
    options: {
      includeCurrentWardrobe: false,
      includeAcquisitionPipeline: false,
      includeFitpics: true,
      includeSavedOutfits: false,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: [],
      collectionExports: [],
      statusExports: [],
      statusExportMode: "separate"
    },
    renderWardrobePng: async ({ fileName }) => ({
      fileName,
      mimeType: "image/webp",
      blob: new Blob([`image:${fileName}`], { type: "image/webp" }),
      report: {
        fileName,
        format: "webp",
        sizeBytes: 20,
        pixelWidth: 100,
        pixelHeight: 100
      }
    }),
    renderFitpicPng: async ({ fileName }) => ({
      fileName,
      blob: new Blob([`fitpic:${fileName}`], { type: "image/webp" }),
      report: {
        fileName,
        sizeBytes: 18,
        targetBytes: 30,
        budgetExceeded: false
      }
    })
  });
  const files = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));

  assert.equal(files["fitpics/fitpics.csv"] !== undefined, true);
  assert.equal(files["fitpics/fitpics-compact.webp"] !== undefined, true);
  assert.equal(files["fitpics/fitpics-details.webp"] !== undefined, true);
});

test("warning isolation keeps only the known wardrobe warning when fitpic media refs are valid", async () => {
  await seedFitpicMediaFixture();

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
      savedOutfits: [],
      fitpics: [createFitpicRefFixture()]
    }
  });

  assert.equal(result.warningCount, 1);
  assert.equal(result.warnings[0].entityType, "oaWardrobeAsset");
  assert.equal(result.warnings.some((warning) => warning.entityType === "oaFitpicImage"), false);

  const imported = await importBackupPackage({
    file: new Blob([zipSync(Object.fromEntries(result.files.entries()))], { type: "application/zip" })
  });

  assert.equal(imported.warnings.length, 0);
  assert.equal(imported.backup.mediaRecords.length, 3);
});

test("persisted appState stays small and fitpic ref-only after Backup v2 restore", async () => {
  await seedFitpicMediaFixture();

  const zipResult = await buildBackupPackageZip({
    items: [],
    appState: {
      savedOutfits: [],
      fitpics: [createFitpicRefFixture()]
    }
  });

  const imported = await importBackupPackage({
    file: zipResult.blob
  });

  await replaceWithBackup(imported.backup);

  const persistedAppState = await loadAppState();
  const persistedJson = JSON.stringify(persistedAppState);

  assert.equal(persistedJson.length < 10_000, true);
  assert.equal(persistedJson.includes("data:image/"), false);
  assert.equal(persistedAppState.fitpics[0].imageData, "");
  assert.equal(typeof persistedAppState.fitpics[0].images.display.src, "undefined");
  assert.equal(typeof persistedAppState.fitpics[0].fitpicImages[0].images.preview.src, "undefined");
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
  assert.equal(imported.backup.appState.fitpics[0].images.original.mediaId, "fitpicImage:fitpic-image-1:original");
  assert.equal(imported.backup.appState.fitpics[0].images.display.mediaId, "fitpicImage:fitpic-image-1:display");
  assert.equal(imported.backup.appState.fitpics[0].fitpicImages[0].images.preview.mediaId, "fitpicImage:fitpic-image-1:display");
  assert.equal(imported.backup.mediaRecords.length, 3);
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
