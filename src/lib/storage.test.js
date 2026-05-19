import test from "node:test";
import assert from "node:assert/strict";

import { INDEXED_DB_NAME } from "./appIdentity.js";
import {
  backfillLocalSyncMetadata,
  exportBackup,
  getOrCreateDeviceId,
  getSyncMetadata,
  loadAppState,
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
  const item = {
    id: "item_1",
    itemUuid: "item-uuid-1",
    name: "Item 1"
  };

  await saveItem(item);

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
    ]
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
