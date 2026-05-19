import defaultWardrobe from "../data/defaultWardrobe.js";
import defaultAppState from "../data/defaultAppState.js";
import { BACKUP_SOURCE, BACKUP_VERSION, INDEXED_DB_NAME } from "./appIdentity.js";

const DB_NAME = INDEXED_DB_NAME;
const DB_VERSION = 2;
const ITEM_STORE = "items";
const APP_STORE = "appState";
const SYNC_STATE_STORE = "syncState";
const SYNC_METADATA_STORE = "syncMetadata";
const SYNC_STATE_KEY = "state";

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

function normalizeSyncText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSyncBoolean(value) {
  return Boolean(value);
}

function normalizeSyncNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? Math.round(numericValue) : fallback;
}

function normalizeSyncTimestamp(value) {
  const trimmedValue = normalizeSyncText(value);

  if (!trimmedValue) {
    return "";
  }

  const parsedValue = Date.parse(trimmedValue);
  return Number.isFinite(parsedValue) ? new Date(parsedValue).toISOString() : "";
}

function normalizeSyncMetadataKey(value) {
  return normalizeSyncText(value);
}

function buildItemSyncMetadataKey(itemUuid) {
  const stableKey = normalizeSyncText(itemUuid);
  return stableKey ? `oa:item:${stableKey}` : "";
}

function buildSavedOutfitSyncMetadataKey(outfitUuid) {
  const stableKey = normalizeSyncText(outfitUuid);
  return stableKey ? `oa:savedOutfit:${stableKey}` : "";
}

function getCurrentSyncTimestamp() {
  return new Date().toISOString();
}

function inferStableKeyFromSyncMetadataKey(key) {
  if (key.startsWith("oa:item:")) {
    return key.slice("oa:item:".length);
  }

  if (key.startsWith("oa:savedOutfit:")) {
    return key.slice("oa:savedOutfit:".length);
  }

  return "";
}

function normalizeSyncEntityType(value, key = "") {
  const normalizedValue = normalizeSyncText(value);

  if (normalizedValue === "item") {
    return "oaItem";
  }

  if (normalizedValue === "savedOutfit") {
    return "oaSavedOutfit";
  }

  if (normalizedValue) {
    return normalizedValue;
  }

  if (key.startsWith("oa:item:")) {
    return "oaItem";
  }

  if (key.startsWith("oa:savedOutfit:")) {
    return "oaSavedOutfit";
  }

  return "";
}

function normalizeSyncMetadataRecord(record) {
  const key = normalizeSyncMetadataKey(record?.key);

  if (!key) {
    throw new Error("Sync metadata entry is missing a key.");
  }

  return {
    key,
    entityType: normalizeSyncEntityType(record?.entityType, key),
    stableKey: normalizeSyncText(record?.stableKey) || normalizeSyncText(record?.entityUuid) || inferStableKeyFromSyncMetadataKey(key),
    localId: normalizeSyncText(record?.localId) || normalizeSyncText(record?.legacyId),
    recordVersion: normalizeSyncNumber(record?.recordVersion),
    syncStatus: normalizeSyncText(record?.syncStatus),
    lastSyncedAt: normalizeSyncTimestamp(record?.lastSyncedAt),
    lastModifiedByDevice: normalizeSyncText(record?.lastModifiedByDevice),
    pendingDelete: normalizeSyncBoolean(record?.pendingDelete),
    lastSyncError:
      record?.lastSyncError === null || record?.lastSyncError === undefined
        ? ""
        : typeof record.lastSyncError === "string"
          ? record.lastSyncError.trim()
          : JSON.stringify(record.lastSyncError),
    lastLocalChangeAt: normalizeSyncTimestamp(record?.lastLocalChangeAt)
  };
}

function createDefaultSyncState(deviceId = "", now = getCurrentSyncTimestamp()) {
  const normalizedNow = normalizeSyncTimestamp(now) || getCurrentSyncTimestamp();
  return {
    key: SYNC_STATE_KEY,
    deviceId: normalizeSyncText(deviceId),
    createdAt: normalizedNow,
    updatedAt: normalizedNow,
    lastPushCursor: "",
    lastPullCursor: ""
  };
}

function normalizeSyncStateRecord(record, fallbackNow = getCurrentSyncTimestamp()) {
  const normalizedFallbackNow = normalizeSyncTimestamp(fallbackNow) || getCurrentSyncTimestamp();
  const deviceId = normalizeSyncText(record?.deviceId);
  const createdAt = normalizeSyncTimestamp(record?.createdAt) || normalizedFallbackNow;
  const updatedAt = normalizeSyncTimestamp(record?.updatedAt) || createdAt;

  return {
    key: SYNC_STATE_KEY,
    deviceId,
    createdAt,
    updatedAt,
    lastPushCursor: normalizeSyncText(record?.lastPushCursor),
    lastPullCursor: normalizeSyncText(record?.lastPullCursor)
  };
}

function buildLocalOnlySyncMetadata({
  key,
  entityType,
  stableKey,
  localId,
  lastModifiedByDevice
}) {
  return normalizeSyncMetadataRecord({
    key,
    entityType,
    stableKey,
    localId,
    recordVersion: 0,
    syncStatus: "local_only",
    lastSyncedAt: "",
    lastModifiedByDevice,
    pendingDelete: false,
    lastSyncError: "",
    lastLocalChangeAt: ""
  });
}

function getNextRecordVersion(existingRow) {
  const currentVersion = Number(existingRow?.recordVersion);
  return Number.isFinite(currentVersion) ? currentVersion + 1 : 1;
}

function buildPendingUploadSyncMetadata({
  existingRow,
  key,
  entityType,
  stableKey,
  localId,
  lastModifiedByDevice,
  pendingDelete = false,
  now = getCurrentSyncTimestamp()
}) {
  return normalizeSyncMetadataRecord({
    ...(existingRow ?? buildLocalOnlySyncMetadata({
      key,
      entityType,
      stableKey,
      localId,
      lastModifiedByDevice
    })),
    key,
    entityType,
    stableKey,
    localId,
    recordVersion: getNextRecordVersion(existingRow),
    syncStatus: "pending_upload",
    lastSyncedAt: existingRow?.lastSyncedAt,
    lastModifiedByDevice,
    pendingDelete,
    lastSyncError: "",
    lastLocalChangeAt: now
  });
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
      entityType: "oaSavedOutfit",
      stableKey: outfitUuid,
      localId: savedOutfit.id ?? "",
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
      entityType: "oaSavedOutfit",
      stableKey: outfitUuid,
      localId: savedOutfit.id ?? "",
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
        entityType: "oaItem",
        stableKey: item.itemUuid,
        localId: item.id ?? "",
        lastModifiedByDevice: deviceId
      })
    );

  const savedOutfitRows = savedOutfits
    .filter((savedOutfit) => typeof savedOutfit?.outfitUuid === "string" && savedOutfit.outfitUuid.trim())
    .map((savedOutfit) =>
      buildLocalOnlySyncMetadata({
        key: buildSavedOutfitSyncMetadataKey(savedOutfit.outfitUuid),
        entityType: "oaSavedOutfit",
        stableKey: savedOutfit.outfitUuid,
        localId: savedOutfit.id ?? "",
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

  const stableKey = normalizeSyncText(item?.itemUuid);

  if (!stableKey) {
    return;
  }

  const deviceId = await getOrCreateDeviceId();
  const key = buildItemSyncMetadataKey(stableKey);
  const existingRow = await getSyncMetadata(key);

  await upsertSyncMetadata(
    buildPendingUploadSyncMetadata({
      existingRow,
      key,
      entityType: "oaItem",
      stableKey,
      localId: item.id ?? "",
      lastModifiedByDevice: deviceId
    })
  );
}

export async function deleteItem(id, { skipSyncMetadata = false } = {}) {
  const existingItem = await withStore(ITEM_STORE, "readonly", (store) => store.get(id));
  await withStore(ITEM_STORE, "readwrite", (store) => store.delete(id));

  const stableKey = normalizeSyncText(existingItem?.itemUuid);

  if (skipSyncMetadata || !stableKey) {
    return;
  }

  const remainingItems = await withStore(ITEM_STORE, "readonly", (store) => store.getAll());
  const hasMatchingItem = (Array.isArray(remainingItems) ? remainingItems : []).some(
    (item) => item?.id !== id && normalizeSyncText(item?.itemUuid) === stableKey
  );

  if (hasMatchingItem) {
    return;
  }

  const deviceId = await getOrCreateDeviceId();
  const key = buildItemSyncMetadataKey(stableKey);
  const existingRow = await getSyncMetadata(key);

  await upsertSyncMetadata(
    buildPendingUploadSyncMetadata({
      existingRow,
      key,
      entityType: "oaItem",
      stableKey,
      localId: existingRow?.localId || existingItem?.id || id || "",
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
  const [currentEntry, legacyEntry] = await Promise.all([
    withStore(SYNC_STATE_STORE, "readonly", (store) => store.get(SYNC_STATE_KEY)),
    withStore(SYNC_STATE_STORE, "readonly", (store) => store.get("device"))
  ]);
  const existingEntry = currentEntry ?? legacyEntry ?? null;
  const normalizedEntry = existingEntry ? normalizeSyncStateRecord(existingEntry) : null;

  if (normalizedEntry?.deviceId) {
    const shouldPersistNormalizedState = JSON.stringify(existingEntry) !== JSON.stringify(normalizedEntry);

    if (shouldPersistNormalizedState) {
      await withStore(SYNC_STATE_STORE, "readwrite", (store) => {
        store.put(normalizedEntry);

        if (legacyEntry?.key === "device") {
          store.delete("device");
        }
      });
    }

    return normalizedEntry.deviceId;
  }

  const nextState = createDefaultSyncState(createLocalUuid("device"));
  await withStore(SYNC_STATE_STORE, "readwrite", (store) => {
    store.put(nextState);

    if (legacyEntry?.key === "device") {
      store.delete("device");
    }
  });

  return nextState.deviceId;
}

export async function getSyncMetadata(key = null) {
  if (typeof key === "string") {
    const normalizedKey = normalizeSyncMetadataKey(key);

    if (!normalizedKey) {
      return null;
    }

    const rawEntry = await withStore(SYNC_METADATA_STORE, "readonly", (store) => store.get(normalizedKey));

    if (!rawEntry) {
      return null;
    }

    const normalizedEntry = normalizeSyncMetadataRecord(rawEntry);

    if (JSON.stringify(rawEntry) !== JSON.stringify(normalizedEntry)) {
      await withStore(SYNC_METADATA_STORE, "readwrite", (store) => store.put(normalizedEntry));
    }

    return normalizedEntry;
  }

  const rawEntries = await withStore(SYNC_METADATA_STORE, "readonly", (store) => store.getAll());
  const normalizedEntries = rawEntries.map((entry) => normalizeSyncMetadataRecord(entry));

  if (JSON.stringify(rawEntries) !== JSON.stringify(normalizedEntries)) {
    await withStore(SYNC_METADATA_STORE, "readwrite", (store) => {
      normalizedEntries.forEach((entry) => store.put(entry));
    });
  }

  return normalizedEntries;
}

export async function upsertSyncMetadata(value) {
  const normalizedValue = normalizeSyncMetadataRecord(value);
  await withStore(SYNC_METADATA_STORE, "readwrite", (store) => store.put(normalizedValue));
  return normalizedValue;
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
