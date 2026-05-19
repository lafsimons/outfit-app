import test from "node:test";
import assert from "node:assert/strict";

import { INDEXED_DB_NAME } from "./appIdentity.js";
import {
  backfillLocalSyncMetadata,
  exportBackup,
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
  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 2));
  const storeNames = [...db.objectStoreNames.stores.keys()].sort();
  db.close();
  return storeNames;
}

async function getSyncMetadataRows() {
  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 2));
  const transaction = db.transaction("syncMetadata", "readonly");
  const rows = await openRequestToPromise(transaction.objectStore("syncMetadata").getAll());
  await transactionDone(transaction);
  db.close();
  return rows;
}

async function getStoredItems() {
  const db = await openRequestToPromise(globalThis.indexedDB.open(INDEXED_DB_NAME, 2));
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

test("deviceId is created and then reused", async () => {
  const firstDeviceId = await getOrCreateDeviceId();
  const secondDeviceId = await getOrCreateDeviceId();

  assert.equal(typeof firstDeviceId, "string");
  assert.notEqual(firstDeviceId, "");
  assert.equal(secondDeviceId, firstDeviceId);
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
    app: "oa",
    entityType: "item",
    entityUuid: "item-uuid-1",
    legacyId: "item_1",
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: null,
    lastModifiedByDevice: firstBackfill.deviceId,
    pendingDelete: false,
    lastSyncError: null
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
    app: "oa",
    entityType: "savedOutfit",
    entityUuid: "outfit-uuid-1",
    legacyId: "saved_1",
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: null,
    lastModifiedByDevice: backfill.deviceId,
    pendingDelete: false,
    lastSyncError: null
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

  assert.equal(createdMetadata.legacyId, "item_1");
  assert.equal(createdMetadata.recordVersion, 1);
  assert.equal(createdMetadata.syncStatus, "pending_upload");
  assert.equal(createdMetadata.pendingDelete, false);
  assert.equal(createdMetadata.lastSyncedAt, null);
  assert.equal(createdMetadata.lastSyncError, null);
  assert.equal(typeof createdMetadata.lastModifiedByDevice, "string");
  assert.notEqual(createdMetadata.lastModifiedByDevice, "");

  await upsertSyncMetadata({
    ...createdMetadata,
    recordVersion: 4,
    syncStatus: "synced",
    lastSyncedAt: "2024-02-01T00:00:00.000Z",
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
  assert.equal(updatedMetadata.lastSyncError, null);
  assert.equal(updatedMetadata.legacyId, "item_1");
  assert.equal(updatedMetadata.lastModifiedByDevice, createdMetadata.lastModifiedByDevice);
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
  assert.equal(metadata.legacyId, "item_1");
});

test("item legacy-id rename preserves one metadata row keyed by itemUuid", async () => {
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
  await deleteItem("shirt_1", { skipSyncMetadata: true });

  const metadata = await getSyncMetadata("oa:item:item-uuid-1");
  const syncRows = await getSyncMetadataRows();
  const items = await loadItems();

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "shirt_renamed");
  assert.equal(syncRows.length, 1);
  assert.equal(metadata.entityUuid, "item-uuid-1");
  assert.equal(metadata.legacyId, "shirt_renamed");
  assert.equal(metadata.pendingDelete, false);
  assert.equal(metadata.recordVersion, 2);
});

test("saved outfit create edit and delete dirty marking updates one metadata row", async () => {
  const savedOutfit = {
    id: "saved_1",
    outfitUuid: "outfit-uuid-1",
    name: "Saved outfit",
    description: "",
    outfit: { TopInner: "top_1" },
    outfitItemUuids: { TopInner: "item-uuid-1" },
    layering: false
  };

  await saveAppState({
    savedOutfits: [savedOutfit]
  });

  const createdMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-1");
  assert.equal(createdMetadata.recordVersion, 1);
  assert.equal(createdMetadata.syncStatus, "pending_upload");
  assert.equal(createdMetadata.pendingDelete, false);

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
        description: "Updated"
      }
    ]
  });

  const editedMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-1");
  assert.equal(editedMetadata.recordVersion, 4);
  assert.equal(editedMetadata.syncStatus, "pending_upload");
  assert.equal(editedMetadata.pendingDelete, false);
  assert.equal(editedMetadata.lastSyncedAt, "2024-04-01T00:00:00.000Z");

  await saveAppState({
    savedOutfits: []
  });

  const deletedMetadata = await getSyncMetadata("oa:savedOutfit:outfit-uuid-1");
  assert.equal(deletedMetadata.recordVersion, 5);
  assert.equal(deletedMetadata.syncStatus, "pending_upload");
  assert.equal(deletedMetadata.pendingDelete, true);
  assert.equal(deletedMetadata.legacyId, "saved_1");
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

test("backup import clears and rebuilds sync metadata", async () => {
  const originalDeviceId = await getOrCreateDeviceId();

  await upsertSyncMetadata({
    key: "oa:item:stale",
    app: "oa",
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
    app: "oa",
    entityType: "item",
    entityUuid: "item-uuid-2",
    legacyId: "item_2",
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: null,
    lastModifiedByDevice: originalDeviceId,
    pendingDelete: false,
    lastSyncError: null
  });
  assert.deepEqual(savedOutfitMetadata, {
    key: "oa:savedOutfit:outfit-uuid-2",
    app: "oa",
    entityType: "savedOutfit",
    entityUuid: "outfit-uuid-2",
    legacyId: "saved_2",
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: null,
    lastModifiedByDevice: originalDeviceId,
    pendingDelete: false,
    lastSyncError: null
  });
});
