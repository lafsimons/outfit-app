import test from "node:test";
import assert from "node:assert/strict";
import * as storage from "../lib/storage.js";
import * as itemsRepository from "./itemsRepository.js";

test("itemsRepository re-exports storage item persistence", () => {
  assert.equal(itemsRepository.loadAll, storage.loadItems);
  assert.equal(itemsRepository.save, storage.saveItem);
  assert.equal(itemsRepository.remove, storage.deleteItem);
});
