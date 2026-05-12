import test from "node:test";
import assert from "node:assert/strict";
import * as storage from "../lib/storage.js";
import * as appStateRepository from "./appStateRepository.js";

test("appStateRepository re-exports storage app-state persistence", () => {
  assert.equal(appStateRepository.load, storage.loadAppState);
  assert.equal(appStateRepository.save, storage.saveAppState);
});
