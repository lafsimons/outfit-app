import test from "node:test";
import assert from "node:assert/strict";
import * as storage from "../lib/storage.js";
import * as backupRepository from "./backupRepository.js";

test("backupRepository re-exports storage backup helpers", () => {
  assert.equal(backupRepository.exportBackup, storage.exportBackup);
  assert.equal(backupRepository.getDefaultData, storage.getDefaultData);
  assert.equal(backupRepository.replaceWithBackup, storage.replaceWithBackup);
  assert.equal(backupRepository.resetToDefaults, storage.resetToDefaults);
});
