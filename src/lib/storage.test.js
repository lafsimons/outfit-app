import test from "node:test";
import assert from "node:assert/strict";

import { INDEXED_DB_NAME } from "./appIdentity.js";
import {
  backfillLocalSyncMetadata,
  exportBackup,
  exportLibraryCsv,
  getOrCreateDeviceId,
  getSyncMetadata,
  loadAppState,
  deleteItem,
  loadItems,
  replaceWithBackup,
  saveAppState,
  saveItem,
  upsertSyncMetadata
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
        records: new Map()
      });
    }
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

  getAll() {
    return this.transaction.createRequest(() =>
      [...this.store.records.values()].map((value) => structuredClone(value))
    );
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

  delete(key) {
    return this.transaction.createRequest(() => {
      this.store.records.delete(key);
      return undefined;
    });
  }

  clear() {
    return this.transaction.createRequest(() => {
      this.store.records.clear();
      return undefined;
    });
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

function openRequestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function seedLegacyDatabase({ items = [], appState = null } = {}) {
  const request = globalThis.indexedDB.open(INDEXED_DB_NAME, 1);

  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore("items", { keyPath: "id" });
    db.createObjectStore("appState", { keyPath: "key" });
  };

  const db = await openRequestToPromise(request);
  const transaction = db.transaction(["items", "appState"], "readwrite");
  const itemsStore = transaction.objectStore("items");
  const appStateStore = transaction.objectStore("appState");

  items.forEach((item) => itemsStore.put(item));

  if (appState) {
    appStateStore.put({
      key: "state",
      value: appState
    });
  }

  await transactionDone(transaction);
  db.close();
}

async function getStoreNames() {
  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 3));
  const storeNames = [...db.objectStoreNames.stores.keys()].sort();
  db.close();
  return storeNames;
}

async function getSyncMetadataRows() {
  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 3));
  const transaction = db.transaction("syncMetadata", "readonly");
  const rows = await openRequestToPromise(transaction.objectStore("syncMetadata").getAll());
  await transactionDone(transaction);
  db.close();
  return rows;
}

async function getSyncStateRows() {
  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 3));
  const transaction = db.transaction("syncState", "readonly");
  const rows = await openRequestToPromise(transaction.objectStore("syncState").getAll());
  await transactionDone(transaction);
  db.close();
  return rows;
}

async function getStoredItems() {
  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 3));
  const transaction = db.transaction("items", "readonly");
  const rows = await openRequestToPromise(transaction.objectStore("items").getAll());
  await transactionDone(transaction);
  db.close();
  return rows;
}

test.beforeEach(() => {
  globalThis.indexedDB = new FakeIndexedDB();
  globalThis.IDBRequest = FakeIDBRequest;
});

test.after(() => {
  delete globalThis.indexedDB;
  delete globalThis.IDBRequest;
});

test("IndexedDB upgrade creates sync stores without breaking existing stores", async () => {
  await seedLegacyDatabase({
    items: [
      {
        id: "legacy_item",
        itemUuid: "item-uuid-1",
        name: "Legacy item"
      }
    ],
    appState: {
      savedOutfits: [
        {
          id: "saved_1",
          outfitUuid: "outfit-uuid-1",
          name: "Saved outfit",
          description: "",
          outfit: {},
          outfitItemUuids: {},
          layering: false
        }
      ]
    }
  });

  const items = await loadItems();
  const appState = await loadAppState();
  const storeNames = await getStoreNames();

  assert.equal(items[0].id, "legacy_item");
  assert.equal(appState.savedOutfits[0].outfitUuid, "outfit-uuid-1");
  assert.deepEqual(storeNames, ["appState", "items", "syncMetadata", "syncState"]);
});

test("appState save and load preserves additive fitpic and saved outfit secondary-entity fields", async () => {
  await saveAppState({
    savedOutfits: [
      {
        id: "saved_1",
        outfitUuid: "outfit-uuid-1",
        name: "Saved outfit",
        description: "",
        tags: ["Evening"],
        favorite: true,
        createdAt: "2024-04-01T00:00:00.000Z",
        updatedAt: "2024-04-02T00:00:00.000Z",
        outfit: { TopInner: "top_1" },
        outfitItemUuids: { TopInner: "item-uuid-1" },
        layering: false
      }
    ],
    fitpics: [
      {
        id: "fitpic_1",
        fitpicUuid: "fitpic-uuid-1",
        name: "Fitpic",
        imageData: "data:image/png;base64,fitpic",
        fitDate: "2024-03-01T00:00:00.000Z",
        linkedItemUuids: ["item-uuid-1"],
        linkedItemIds: ["top_1"],
        savedOutfitUuid: "outfit-uuid-1",
        savedOutfitId: "saved_1"
      }
    ]
  });

  const appState = await loadAppState();

  assert.deepEqual(appState.savedOutfits[0].tags, ["Evening"]);
  assert.equal(appState.savedOutfits[0].favorite, true);
  assert.equal(appState.savedOutfits[0].createdAt, "2024-04-01T00:00:00.000Z");
  assert.equal(appState.savedOutfits[0].updatedAt, "2024-04-02T00:00:00.000Z");
  assert.equal(appState.fitpics[0].fitDate, "2024-03-01T00:00:00.000Z");
  assert.deepEqual(appState.fitpics[0].linkedItemUuids, ["item-uuid-1"]);
  assert.deepEqual(appState.fitpics[0].linkedItemIds, ["top_1"]);
  assert.equal(appState.fitpics[0].savedOutfitUuid, "outfit-uuid-1");
  assert.equal(appState.fitpics[0].savedOutfitId, "saved_1");
});

test("deviceId is created and then reused", async () => {
  const firstDeviceId = await getOrCreateDeviceId();
  const secondDeviceId = await getOrCreateDeviceId();
  const syncStateRows = await getSyncStateRows();

  assert.equal(typeof firstDeviceId, "string");
  assert.notEqual(firstDeviceId, "");
  assert.equal(secondDeviceId, firstDeviceId);
  assert.deepEqual(syncStateRows.map((row) => row.key), ["state"]);
  assert.equal(syncStateRows[0].deviceId, firstDeviceId);
  assert.equal(typeof syncStateRows[0].createdAt, "string");
  assert.equal(typeof syncStateRows[0].updatedAt, "string");
  assert.equal(syncStateRows[0].lastPushCursor, "");
  assert.equal(syncStateRows[0].lastPullCursor, "");
});

test("existing items backfill local-only metadata by itemUuid", async () => {
  await seedLegacyDatabase({
    items: [
      {
        id: "item_1",
        itemUuid: "item-uuid-1",
        name: "Item 1"
      }
    ]
  });

  const [item] = await loadItems();

  const firstBackfill = await backfillLocalSyncMetadata({
    items: [item]
  });
  const metadata = await getSyncMetadata("oa:item:item-uuid-1");
  const secondBackfill = await backfillLocalSyncMetadata({
    items: [item]
  });

  assert.equal(firstBackfill.createdCount, 1);
  assert.equal(secondBackfill.createdCount, 0);
  assert.deepEqual(metadata, {
    key: "oa:item:item-uuid-1",
    entityType: "oaItem",
    stableKey: "item-uuid-1",
    localId: "item_1",
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice: firstBackfill.deviceId,
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
});

test("existing saved outfits backfill local-only metadata by outfitUuid", async () => {
  await seedLegacyDatabase({
    appState: {
      savedOutfits: [
        {
          id: "saved_1",
          outfitUuid: "outfit-uuid-1",
          name: "Saved outfit",
          description: "",
          outfit: {},
          outfitItemUuids: {},
          layering: false
        }
      ]
    }
  });

  const appState = await loadAppState();
  const backfill = await backfillLocalSyncMetadata({
    savedOutfits: appState.savedOutfits
  });
  const metadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-1");

  assert.equal(backfill.createdCount, 1);
  assert.deepEqual(metadata, {
    key: "oa:savedOutfit:outfit-uuid-1",
    entityType: "oaSavedOutfit",
    stableKey: "outfit-uuid-1",
    localId: "saved_1",
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice: backfill.deviceId,
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
});

test("item create and update dirty marking increments version and preserves sync history", async () => {
  const createdItem = {
    id: "item_1",
    itemUuid: "item-uuid-1",
    name: "Item 1"
  };

  await saveItem(createdItem);

  const createdMetadata = await getSyncMetadata("oa:item:item-uuid-1");

  assert.equal(createdMetadata.entityType, "oaItem");
  assert.equal(createdMetadata.stableKey, "item-uuid-1");
  assert.equal(createdMetadata.localId, "item_1");
  assert.equal(createdMetadata.recordVersion, 1);
  assert.equal(createdMetadata.syncStatus, "pending_upload");
  assert.equal(createdMetadata.pendingDelete, false);
  assert.equal(createdMetadata.lastSyncedAt, "");
  assert.equal(createdMetadata.lastSyncError, "");
  assert.equal(typeof createdMetadata.lastModifiedByDevice, "string");
  assert.notEqual(createdMetadata.lastModifiedByDevice, "");
  assert.equal(createdMetadata.lastLocalChangeAt.length > 0, true);

  await upsertSyncMetadata({
    ...createdMetadata,
    recordVersion: 4,
    syncStatus: "synced",
    lastSyncedAt: "2024-02-01T00:00:00.000Z",
    lastLocalChangeAt: "2024-02-02T00:00:00.000Z",
    lastSyncError: { message: "stale", at: "2024-02-02T00:00:00.000Z" }
  });

  await saveItem({
    ...createdItem,
    name: "Updated item"
  });

  const updatedMetadata = await getSyncMetadata("oa:item:item-uuid-1");

  assert.equal(updatedMetadata.recordVersion, 5);
  assert.equal(updatedMetadata.syncStatus, "pending_upload");
  assert.equal(updatedMetadata.pendingDelete, false);
  assert.equal(updatedMetadata.lastSyncedAt, "2024-02-01T00:00:00.000Z");
  assert.equal(updatedMetadata.lastSyncError, "");
  assert.equal(updatedMetadata.localId, "item_1");
  assert.equal(updatedMetadata.lastModifiedByDevice, createdMetadata.lastModifiedByDevice);
  assert.notEqual(updatedMetadata.lastLocalChangeAt, "2024-02-02T00:00:00.000Z");
});

test("item delete preserves metadata row as a pending-upload tombstone", async () => {
  const item = {
    id: "item_1",
    itemUuid: "item-uuid-1",
    name: "Item 1"
  };

  await saveItem(item);
  await upsertSyncMetadata({
    ...(await getSyncMetadata("oa:item:item-uuid-1")),
    recordVersion: 2,
    syncStatus: "synced",
    lastSyncedAt: "2024-03-01T00:00:00.000Z"
  });

  await deleteItem("item_1");

  const metadata = await getSyncMetadata("oa:item:item-uuid-1");
  const items = await getStoredItems();

  assert.equal(items.length, 0);
  assert.equal(metadata.recordVersion, 3);
  assert.equal(metadata.pendingDelete, true);
  assert.equal(metadata.syncStatus, "pending_upload");
  assert.equal(metadata.lastSyncedAt, "2024-03-01T00:00:00.000Z");
  assert.equal(metadata.localId, "item_1");
  assert.equal(metadata.lastLocalChangeAt.length > 0, true);
});

test("item legacy-id rename preserves one metadata row keyed by itemUuid without a tombstone", async () => {
  const originalItem = {
    id: "shirt_1",
    itemUuid: "item-uuid-1",
    name: "Shirt"
  };
  const renamedItem = {
    ...originalItem,
    id: "shirt_renamed"
  };

  await saveItem(originalItem);
  await saveItem(renamedItem);
  await deleteItem("shirt_1");

  const metadata = await getSyncMetadata("oa:item:item-uuid-1");
  const syncRows = await getSyncMetadataRows();
  const items = await loadItems();

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "shirt_renamed");
  assert.equal(syncRows.length, 1);
  assert.equal(metadata.entityType, "oaItem");
  assert.equal(metadata.stableKey, "item-uuid-1");
  assert.equal(metadata.localId, "shirt_renamed");
  assert.equal(metadata.pendingDelete, false);
  assert.equal(metadata.recordVersion, 2);
});

test("saved outfit create edit and delete dirty marking updates one metadata row", async () => {
  const savedOutfit = {
    id: "saved_1",
    outfitUuid: "outfit-uuid-1",
    name: "Saved outfit",
    description: "",
    tags: [],
    favorite: false,
    createdAt: "2024-04-01T00:00:00.000Z",
    updatedAt: "2024-04-01T00:00:00.000Z",
    outfit: { TopInner: "top_1" },
    outfitItemUuids: { TopInner: "item-uuid-1" },
    layering: false
  };

  await saveAppState({
    savedOutfits: [savedOutfit]
  });

  const createdMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-1");
  assert.equal(createdMetadata.entityType, "oaSavedOutfit");
  assert.equal(createdMetadata.localId, "saved_1");
  assert.equal(createdMetadata.recordVersion, 1);
  assert.equal(createdMetadata.syncStatus, "pending_upload");
  assert.equal(createdMetadata.pendingDelete, false);
  assert.equal(createdMetadata.lastLocalChangeAt.length > 0, true);

  await upsertSyncMetadata({
    ...createdMetadata,
    recordVersion: 3,
    syncStatus: "synced",
    lastSyncedAt: "2024-04-01T00:00:00.000Z"
  });

  await saveAppState({
    savedOutfits: [
      {
        ...savedOutfit,
        name: "Edited outfit",
        description: "Updated",
        tags: ["Evening", "Black"],
        favorite: true,
        updatedAt: "2024-04-02T00:00:00.000Z"
      }
    ]
  });

  const editedMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-1");
  const editedState = await loadAppState();
  assert.equal(editedMetadata.recordVersion, 4);
  assert.equal(editedMetadata.syncStatus, "pending_upload");
  assert.equal(editedMetadata.pendingDelete, false);
  assert.equal(editedMetadata.lastSyncedAt, "2024-04-01T00:00:00.000Z");
  assert.equal(editedMetadata.lastLocalChangeAt.length > 0, true);
  assert.equal(editedState.savedOutfits[0].createdAt, "2024-04-01T00:00:00.000Z");
  assert.equal(editedState.savedOutfits[0].updatedAt, "2024-04-02T00:00:00.000Z");
  assert.deepEqual(editedState.savedOutfits[0].tags, ["Evening", "Black"]);
  assert.equal(editedState.savedOutfits[0].favorite, true);

  await saveAppState({
    savedOutfits: []
  });

  const deletedMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-1");
  assert.equal(deletedMetadata.recordVersion, 5);
  assert.equal(deletedMetadata.syncStatus, "pending_upload");
  assert.equal(deletedMetadata.pendingDelete, true);
  assert.equal(deletedMetadata.localId, "saved_1");
  assert.equal(deletedMetadata.lastLocalChangeAt.length > 0, true);
});

test("saved outfit metadata is dirtied when item id rewrites or deletes change the outfit payload", async () => {
  const affectedByRename = {
    id: "saved_rename",
    outfitUuid: "outfit-uuid-rename",
    name: "Rename target",
    description: "",
    outfit: { TopInner: "top_1" },
    outfitItemUuids: { TopInner: "item-uuid-1" },
    layering: false
  };
  const affectedByDelete = {
    id: "saved_delete",
    outfitUuid: "outfit-uuid-delete",
    name: "Delete target",
    description: "",
    outfit: { TopInner: "top_2" },
    outfitItemUuids: { TopInner: "item-uuid-2" },
    layering: false
  };
  const unaffected = {
    id: "saved_same",
    outfitUuid: "outfit-uuid-same",
    name: "Unchanged",
    description: "",
    outfit: { Bottom: "bottom_1" },
    outfitItemUuids: { Bottom: "item-uuid-3" },
    layering: false
  };

  await saveAppState({
    savedOutfits: [affectedByRename, affectedByDelete, unaffected]
  });

  await upsertSyncMetadata({
    ...(await getSyncMetadata("oa:savedOutfit:outfit-uuid-rename")),
    recordVersion: 7,
    syncStatus: "synced",
    lastSyncedAt: "2024-05-01T00:00:00.000Z"
  });
  await upsertSyncMetadata({
    ...(await getSyncMetadata("oa:savedOutfit:outfit-uuid-delete")),
    recordVersion: 9,
    syncStatus: "synced",
    lastSyncedAt: "2024-05-02T00:00:00.000Z"
  });
  await upsertSyncMetadata({
    ...(await getSyncMetadata("oa:savedOutfit:outfit-uuid-same")),
    recordVersion: 11,
    syncStatus: "synced",
    lastSyncedAt: "2024-05-03T00:00:00.000Z"
  });

  await saveAppState({
    savedOutfits: [
      {
        ...affectedByRename,
        outfit: { TopInner: "top_renamed" }
      },
      {
        ...affectedByDelete,
        outfit: { TopInner: null },
        outfitItemUuids: { TopInner: "item-uuid-2" }
      },
      unaffected
    ]
  });

  const renamedMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-rename");
  const deletedMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-delete");
  const unchangedMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-same");

  assert.equal(renamedMetadata.recordVersion, 8);
  assert.equal(renamedMetadata.syncStatus, "pending_upload");
  assert.equal(renamedMetadata.pendingDelete, false);
  assert.equal(renamedMetadata.lastSyncedAt, "2024-05-01T00:00:00.000Z");

  assert.equal(deletedMetadata.recordVersion, 10);
  assert.equal(deletedMetadata.syncStatus, "pending_upload");
  assert.equal(deletedMetadata.pendingDelete, false);
  assert.equal(deletedMetadata.lastSyncedAt, "2024-05-02T00:00:00.000Z");

  assert.equal(unchangedMetadata.recordVersion, 11);
  assert.equal(unchangedMetadata.syncStatus, "synced");
  assert.equal(unchangedMetadata.pendingDelete, false);
  assert.equal(unchangedMetadata.lastSyncedAt, "2024-05-03T00:00:00.000Z");
});

test("backup export output remains unchanged when sync metadata exists", async () => {
  const item = {
    id: "item_1",
    itemUuid: "item-uuid-1",
    name: "Item 1"
  };

  await saveItem(item);
  await saveAppState({
    savedOutfits: [
      {
        id: "saved_1",
        outfitUuid: "outfit-uuid-1",
        name: "Saved outfit",
        description: "",
        outfit: {},
        outfitItemUuids: {},
        layering: false
      }
    ],
    recentOutfits: [{ key: "recent_1" }]
  });
  await backfillLocalSyncMetadata({
    items: [item],
    savedOutfits: [
      {
        id: "saved_1",
        outfitUuid: "outfit-uuid-1",
        name: "Saved outfit",
        description: "",
        outfit: {},
        outfitItemUuids: {},
        layering: false
      }
    ]
  });

  const backup = await exportBackup();

  assert.deepEqual(Object.keys(backup).sort(), ["appState", "exportedAt", "items", "source", "version"]);
  assert.equal("syncMetadata" in backup, false);
  assert.equal("syncState" in backup, false);
  assert.equal("recentOutfits" in backup.appState, false);
  assert.equal(backup.appState.savedOutfits[0].outfitUuid, "outfit-uuid-1");
});

test("library CSV export includes status and collections for all stored items", async () => {
  await saveItem({
    id: "item_1",
    itemUuid: "item-uuid-1",
    name: "Wardrobe item",
    garmentType: "Top",
    status: "Wardrobe",
    favorite: true,
    quantity: 1,
    collections: ["Travel"],
    styleTags: ["Casual"],
    climateTags: ["Cold"],
    imageUrl: "/images/item-1.png",
    sourceImageWidth: 1200,
    sourceImageHeight: 1600
  });
  await saveItem({
    id: "item_2",
    itemUuid: "item-uuid-2",
    name: "Sold item",
    garmentType: "Bottom",
    status: "Sold",
    favorite: false,
    quantity: 1,
    styleTags: [],
    climateTags: [],
    imageUrl: "/images/item-2.png"
  });
  await saveItem({
    id: "item_3",
    itemUuid: "item-uuid-3",
    name: "Wishlist item",
    garmentType: "Footwear",
    status: "Wishlist",
    favorite: false,
    quantity: 1,
    collections: ["Summer", "Travel"],
    styleTags: ["Formal"],
    climateTags: ["Rain"],
    imageUrl: "/images/item-3.png"
  });

  const csv = await exportLibraryCsv();
  const rows = csv.split("\n");

  assert.equal(rows.length, 4);
  assert.equal(
    rows[0],
    "id,itemUuid,name,brand,garment,type,color,status,favorite,size,weight,quantity,collections,styleTags,climateTags,description,createdAt,updatedAt,imageFilename,imageWidth,imageHeight"
  );
  assert.equal(rows.some((row) => row.includes("Wardrobe item") && row.includes(",Wardrobe,true,")), true);
  assert.equal(rows.some((row) => row.includes("Wardrobe item") && row.includes(",Travel,")), true);
  assert.equal(rows.some((row) => row.includes("Sold item") && row.includes(",Sold,false,")), true);
  assert.equal(rows.some((row) => row.includes("Wishlist item") && row.includes(",Wishlist,false,")), true);
  assert.equal(rows.some((row) => row.includes("Wishlist item") && row.includes(",Summer|Travel,")), true);
});

test("backup import clears and rebuilds sync metadata", async () => {
  const originalDeviceId = await getOrCreateDeviceId();

  await upsertSyncMetadata({
    key: "oa:item:stale",
    entityType: "item",
    entityUuid: "stale",
    legacyId: "stale_id",
    recordVersion: 9,
    syncStatus: "error",
    lastSyncedAt: "2024-01-01T00:00:00.000Z",
    lastModifiedByDevice: originalDeviceId,
    pendingDelete: true,
    lastSyncError: { message: "stale", at: "2024-01-01T00:00:00.000Z" }
  });

  await replaceWithBackup({
    items: [
      {
        id: "item_2",
        itemUuid: "item-uuid-2",
        name: "Imported item"
      }
    ],
    appState: {
      savedOutfits: [
        {
          id: "saved_2",
          outfitUuid: "outfit-uuid-2",
          name: "Imported outfit",
          description: "",
          outfit: {},
          outfitItemUuids: {},
          layering: false
        }
      ]
    }
  });

  const currentDeviceId = await getOrCreateDeviceId();
  const staleMetadata = await getSyncMetadata("oa:item:stale");
  const itemMetadata = await getSyncMetadata("oa:item:item-uuid-2");
  const savedOutfitMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-2");

  assert.equal(currentDeviceId, originalDeviceId);
  assert.equal(staleMetadata, null);
  assert.deepEqual(itemMetadata, {
    key: "oa:item:item-uuid-2",
    entityType: "oaItem",
    stableKey: "item-uuid-2",
    localId: "item_2",
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice: originalDeviceId,
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
  assert.deepEqual(savedOutfitMetadata, {
    key: "oa:savedOutfit:outfit-uuid-2",
    entityType: "oaSavedOutfit",
    stableKey: "outfit-uuid-2",
    localId: "saved_2",
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice: originalDeviceId,
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
});

test("legacy OA metadata rows are normalized and migrated on read", async () => {
  const originalDeviceId = await getOrCreateDeviceId();

  await upsertSyncMetadata({
    key: "oa:item:item-uuid-legacy",
    entityType: "oaItem",
    stableKey: "item-uuid-legacy",
    localId: "legacy-item",
    recordVersion: 1,
    syncStatus: "synced",
    lastSyncedAt: "2024-06-01T00:00:00.000Z",
    lastModifiedByDevice: originalDeviceId,
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });

  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 3));
  const transaction = db.transaction("syncMetadata", "readwrite");
  transaction.objectStore("syncMetadata").put({
    key: "oa:item:item-uuid-legacy",
    app: "oa",
    entityType: "item",
    entityUuid: "item-uuid-legacy",
    legacyId: "legacy-item",
    recordVersion: 1,
    syncStatus: "synced",
    lastSyncedAt: "2024-06-01T00:00:00.000Z",
    lastModifiedByDevice: originalDeviceId,
    pendingDelete: false,
    lastSyncError: { message: "legacy" },
    lastLocalChangeAt: null
  });
  await transactionDone(transaction);
  db.close();

  const metadata = await getSyncMetadata("oa:item:item-uuid-legacy");
  const storedRows = await getSyncMetadataRows();

  assert.deepEqual(metadata, {
    key: "oa:item:item-uuid-legacy",
    entityType: "oaItem",
    stableKey: "item-uuid-legacy",
    localId: "legacy-item",
    recordVersion: 1,
    syncStatus: "synced",
    lastSyncedAt: "2024-06-01T00:00:00.000Z",
    lastModifiedByDevice: originalDeviceId,
    pendingDelete: false,
    lastSyncError: "{\"message\":\"legacy\"}",
    lastLocalChangeAt: ""
  });
  assert.deepEqual(storedRows[0], metadata);
});

test("legacy sync state row is normalized to the shared singleton shape", async () => {
  await getOrCreateDeviceId();
  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 3));
  const transaction = db.transaction("syncState", "readwrite");
  transaction.objectStore("syncState").delete("state");
  transaction.objectStore("syncState").put({
    key: "device",
    deviceId: "device-legacy"
  });
  await transactionDone(transaction);
  db.close();

  const deviceId = await getOrCreateDeviceId();
  const rows = await getSyncStateRows();

  assert.equal(deviceId, "device-legacy");
  assert.deepEqual(rows.map((row) => row.key), ["state"]);
  assert.equal(rows[0].deviceId, "device-legacy");
  assert.equal(typeof rows[0].createdAt, "string");
  assert.equal(typeof rows[0].updatedAt, "string");
  assert.equal(rows[0].lastPushCursor, "");
  assert.equal(rows[0].lastPullCursor, "");
});
