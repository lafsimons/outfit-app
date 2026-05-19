import defaultWardrobe from "../data/defaultWardrobe.js";
import defaultAppState from "../data/defaultAppState.js";
import { BACKUP_SOURCE, BACKUP_VERSION, INDEXED_DB_NAME } from "./appIdentity.js";

const DB_NAME = INDEXED_DB_NAME;
const DB_VERSION = 2;
const ITEM_STORE = "items";
const APP_STORE = "appState";
const SYNC_STATE_STORE = "syncState";
const SYNC_METADATA_STORE = "syncMetadata";
const DEVICE_STATE_KEY = "device";

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripLocalOnlyAppState(appState) {
  if (!appState || typeof appState !== "object") {
    return {};
  }

  const { recentOutfits, ...rest } = appState;
  return rest;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createLocalUuid(prefix) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSyncMetadataKey(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildItemSyncMetadataKey(itemUuid) {
  return `oa:item:${itemUuid}`;
}

function buildSavedOutfitSyncMetadataKey(outfitUuid) {
  return `oa:savedOutfit:${outfitUuid}`;
}

function buildLocalOnlySyncMetadata({
  key,
  entityType,
  entityUuid,
  legacyId,
  lastModifiedByDevice
}) {
  return {
    key,
    app: "oa",
    entityType,
    entityUuid,
    legacyId,
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: null,
    lastModifiedByDevice,
    pendingDelete: false,
    lastSyncError: null
  };
}

function getNextRecordVersion(existingRow) {
  const currentVersion = Number(existingRow?.recordVersion);
  return Number.isFinite(currentVersion) ? currentVersion + 1 : 1;
}

function buildPendingUploadSyncMetadata({
  existingRow,
  key,
  entityType,
  entityUuid,
  legacyId,
  lastModifiedByDevice,
  pendingDelete = false
}) {
  return {
    ...(existingRow ?? buildLocalOnlySyncMetadata({
      key,
      entityType,
      entityUuid,
      legacyId,
      lastModifiedByDevice
    })),
    key,
    app: "oa",
    entityType,
    entityUuid,
    legacyId,
    recordVersion: getNextRecordVersion(existingRow),
    syncStatus: "pending_upload",
    lastModifiedByDevice,
    pendingDelete,
    lastSyncError: null
  };
}

function normalizeSavedOutfits(savedOutfits) {
  return Array.isArray(savedOutfits) ? savedOutfits : [];
}

function getSavedOutfitSignature(savedOutfit) {
  return JSON.stringify(savedOutfit ?? null);
}

function getSavedOutfitSyncUpdates(previousSavedOutfits, nextSavedOutfits, deviceId) {
  const previousByUuid = new Map(
    normalizeSavedOutfits(previousSavedOutfits)
      .filter((savedOutfit) => typeof savedOutfit?.outfitUuid === "string" && savedOutfit.outfitUuid.trim())
      .map((savedOutfit) => [savedOutfit.outfitUuid, savedOutfit])
  );
  const nextByUuid = new Map(
    normalizeSavedOutfits(nextSavedOutfits)
      .filter((savedOutfit) => typeof savedOutfit?.outfitUuid === "string" && savedOutfit.outfitUuid.trim())
      .map((savedOutfit) => [savedOutfit.outfitUuid, savedOutfit])
  );
  const updates = [];

  nextByUuid.forEach((savedOutfit, outfitUuid) => {
    const previousSavedOutfit = previousByUuid.get(outfitUuid);

    if (getSavedOutfitSignature(previousSavedOutfit) === getSavedOutfitSignature(savedOutfit)) {
      return;
    }

    updates.push({
      key: buildSavedOutfitSyncMetadataKey(outfitUuid),
      entityType: "savedOutfit",
      entityUuid: outfitUuid,
      legacyId: savedOutfit.id ?? "",
      lastModifiedByDevice: deviceId,
      pendingDelete: false
    });
  });

  previousByUuid.forEach((savedOutfit, outfitUuid) => {
    if (nextByUuid.has(outfitUuid)) {
      return;
    }

    updates.push({
      key: buildSavedOutfitSyncMetadataKey(outfitUuid),
      entityType: "savedOutfit",
      entityUuid: outfitUuid,
      legacyId: savedOutfit.id ?? "",
      lastModifiedByDevice: deviceId,
      pendingDelete: true
    });
  });

  return updates;
}

function getSyncRows(items = [], savedOutfits = [], deviceId = "") {
  const itemRows = items
    .filter((item) => typeof item?.itemUuid === "string" && item.itemUuid.trim())
    .map((item) =>
      buildLocalOnlySyncMetadata({
        key: buildItemSyncMetadataKey(item.itemUuid),
        entityType: "item",
        entityUuid: item.itemUuid,
        legacyId: item.id ?? "",
        lastModifiedByDevice: deviceId
      })
    );

  const savedOutfitRows = savedOutfits
    .filter((savedOutfit) => typeof savedOutfit?.outfitUuid === "string" && savedOutfit.outfitUuid.trim())
    .map((savedOutfit) =>
      buildLocalOnlySyncMetadata({
        key: buildSavedOutfitSyncMetadataKey(savedOutfit.outfitUuid),
        entityType: "savedOutfit",
        entityUuid: savedOutfit.outfitUuid,
        legacyId: savedOutfit.id ?? "",
        lastModifiedByDevice: deviceId
      })
    );

  return [...itemRows, ...savedOutfitRows];
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ITEM_STORE)) {
        db.createObjectStore(ITEM_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(APP_STORE)) {
        db.createObjectStore(APP_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(SYNC_STATE_STORE)) {
        db.createObjectStore(SYNC_STATE_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(SYNC_METADATA_STORE)) {
        db.createObjectStore(SYNC_METADATA_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, run) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let resultPromise;

    try {
      const result = run(store);
      resultPromise = result instanceof IDBRequest ? requestToPromise(result) : Promise.resolve(result);
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resultPromise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          db.close();
        });
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

async function withStores(storeNames, mode, run) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)]));

    try {
      run(stores);
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resolve();
      db.close();
    };

    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

export async function loadItems() {
  const items = await withStore(ITEM_STORE, "readonly", (store) => store.getAll());

  if (items.length > 0) {
    return items;
  }

  await withStore(ITEM_STORE, "readwrite", (store) => {
    defaultWardrobe.forEach((item) => store.put(item));
  });

  return defaultWardrobe;
}

export async function saveItem(item) {
  await withStore(ITEM_STORE, "readwrite", (store) => store.put(item));

  if (typeof item?.itemUuid !== "string" || !item.itemUuid.trim()) {
    return;
  }

  const deviceId = await getOrCreateDeviceId();
  const key = buildItemSyncMetadataKey(item.itemUuid);
  const existingRow = await getSyncMetadata(key);

  await upsertSyncMetadata(
    buildPendingUploadSyncMetadata({
      existingRow,
      key,
      entityType: "item",
      entityUuid: item.itemUuid,
      legacyId: item.id ?? "",
      lastModifiedByDevice: deviceId
    })
  );
}

export async function deleteItem(id, { skipSyncMetadata = false } = {}) {
  const existingItem = await withStore(ITEM_STORE, "readonly", (store) => store.get(id));
  await withStore(ITEM_STORE, "readwrite", (store) => store.delete(id));

  if (skipSyncMetadata || typeof existingItem?.itemUuid !== "string" || !existingItem.itemUuid.trim()) {
    return;
  }

  const deviceId = await getOrCreateDeviceId();
  const key = buildItemSyncMetadataKey(existingItem.itemUuid);
  const existingRow = await getSyncMetadata(key);

  await upsertSyncMetadata(
    buildPendingUploadSyncMetadata({
      existingRow,
      key,
      entityType: "item",
      entityUuid: existingItem.itemUuid,
      legacyId: existingItem.id ?? id ?? "",
      lastModifiedByDevice: deviceId,
      pendingDelete: true
    })
  );
}

export async function loadAppState() {
  const entry = await withStore(APP_STORE, "readonly", (store) => store.get("state"));
  return entry?.value ?? null;
}

export async function saveAppState(value) {
  const previousState = await loadAppState();
  await withStore(APP_STORE, "readwrite", (store) =>
    store.put({
      key: "state",
      value
    })
  );

  const deviceId = await getOrCreateDeviceId();
  const syncUpdates = getSavedOutfitSyncUpdates(previousState?.savedOutfits, value?.savedOutfits, deviceId);

  for (const update of syncUpdates) {
    const existingRow = await getSyncMetadata(update.key);
    await upsertSyncMetadata(
      buildPendingUploadSyncMetadata({
        existingRow,
        ...update
      })
    );
  }
}

export async function getOrCreateDeviceId() {
  const entry = await withStore(SYNC_STATE_STORE, "readonly", (store) => store.get(DEVICE_STATE_KEY));

  if (typeof entry?.deviceId === "string" && entry.deviceId.trim()) {
    return entry.deviceId;
  }

  const timestamp = new Date().toISOString();
  const deviceId = createLocalUuid("device");

  await withStore(SYNC_STATE_STORE, "readwrite", (store) =>
    store.put({
      key: DEVICE_STATE_KEY,
      deviceId,
      createdAt: timestamp,
      updatedAt: timestamp
    })
  );

  return deviceId;
}

export async function getSyncMetadata(key) {
  const normalizedKey = normalizeSyncMetadataKey(key);

  if (!normalizedKey) {
    return null;
  }

  return (await withStore(SYNC_METADATA_STORE, "readonly", (store) => store.get(normalizedKey))) ?? null;
}

export async function upsertSyncMetadata(value) {
  await withStore(SYNC_METADATA_STORE, "readwrite", (store) => store.put(value));
}

export async function clearSyncMetadata() {
  await withStore(SYNC_METADATA_STORE, "readwrite", (store) => store.clear());
}

export async function backfillLocalSyncMetadata({ items = [], savedOutfits = [] } = {}) {
  const deviceId = await getOrCreateDeviceId();
  const desiredRows = getSyncRows(items, savedOutfits, deviceId);
  const rowsToCreate = [];

  for (const row of desiredRows) {
    const existingRow = await getSyncMetadata(row.key);

    if (!existingRow) {
      rowsToCreate.push(row);
    }
  }

  if (rowsToCreate.length) {
    await withStore(SYNC_METADATA_STORE, "readwrite", (store) => {
      rowsToCreate.forEach((row) => store.put(row));
    });
  }

  return {
    deviceId,
    createdCount: rowsToCreate.length
  };
}

async function rebuildLocalSyncMetadata({ items = [], savedOutfits = [] } = {}) {
  const deviceId = await getOrCreateDeviceId();
  const rows = getSyncRows(items, savedOutfits, deviceId);

  await clearSyncMetadata();

  if (rows.length) {
    await withStore(SYNC_METADATA_STORE, "readwrite", (store) => {
      rows.forEach((row) => store.put(row));
    });
  }

  return {
    deviceId,
    rebuiltCount: rows.length
  };
}

export async function exportBackup() {
  const [items, appState] = await Promise.all([loadItems(), loadAppState()]);

  return {
    source: BACKUP_SOURCE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    appState: stripLocalOnlyAppState(appState)
  };
}

export async function replaceWithBackup(backup) {
  await withStores([ITEM_STORE, APP_STORE], "readwrite", ({ items, appState }) => {
    items.clear();
    appState.clear();

    backup.items.forEach((item) => items.put(item));
    appState.put({
      key: "state",
      value: {
        ...(backup.appState ?? {}),
        recentOutfits: []
      }
    });
  });

  await rebuildLocalSyncMetadata({
    items: Array.isArray(backup?.items) ? backup.items : [],
    savedOutfits: Array.isArray(backup?.appState?.savedOutfits) ? backup.appState.savedOutfits : []
  });
}

export function getDefaultData() {
  return {
    items: cloneData(defaultWardrobe),
    appState: cloneData(defaultAppState)
  };
}

export async function resetToDefaults() {
  await replaceWithBackup(getDefaultData());
  return getDefaultData();
}
