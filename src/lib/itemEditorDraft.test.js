import test from "node:test";
import assert from "node:assert/strict";

import {
  addItemEditorDraftCollection,
  patchOpenItemEditorDraft,
  removeItemEditorDraftCollection,
  toggleItemEditorDraftTag
} from "./itemEditorDraft.js";

const baseDraft = {
  id: "item-1",
  collections: ["Travel"],
  styleTags: ["Casual"],
  climateTags: ["Rain"],
  favorite: false,
  name: "Field Shirt"
};

test("tag toggles preserve collections and unrelated draft fields", () => {
  const updated = toggleItemEditorDraftTag(baseDraft, "styleTags", "Formal", [
    "Casual",
    "Formal"
  ]);

  assert.deepEqual(updated.collections, ["Travel"]);
  assert.deepEqual(updated.styleTags, ["Casual", "Formal"]);
  assert.equal(updated.name, "Field Shirt");
});

test("collection mutations preserve unsaved tag changes", () => {
  const draftWithUnsavedTags = {
    ...baseDraft,
    styleTags: ["Casual", "Formal"],
    climateTags: ["Rain", "Snow"]
  };

  const added = addItemEditorDraftCollection(draftWithUnsavedTags, "Workwear");
  assert.deepEqual(added.collections, ["Travel", "Workwear"]);
  assert.deepEqual(added.styleTags, ["Casual", "Formal"]);
  assert.deepEqual(added.climateTags, ["Rain", "Snow"]);

  const removed = removeItemEditorDraftCollection(added, "Travel");
  assert.deepEqual(removed.collections, ["Workwear"]);
  assert.deepEqual(removed.styleTags, ["Casual", "Formal"]);
  assert.deepEqual(removed.climateTags, ["Rain", "Snow"]);
});

test("collection interactions that do not change collections never change tags", () => {
  const draftWithUnsavedTags = {
    ...baseDraft,
    styleTags: ["Casual", "Formal", "Smart Casual"],
    climateTags: ["Rain", "Snow"]
  };

  const noopResult = addItemEditorDraftCollection(draftWithUnsavedTags, "Travel");

  assert.deepEqual(noopResult.collections, ["Travel"]);
  assert.deepEqual(noopResult.styleTags, ["Casual", "Formal", "Smart Casual"]);
  assert.deepEqual(noopResult.climateTags, ["Rain", "Snow"]);
});

test("tag mutations preserve unsaved collection changes", () => {
  const draftWithUnsavedCollections = {
    ...baseDraft,
    collections: ["Travel", "Workwear"]
  };

  const updated = toggleItemEditorDraftTag(draftWithUnsavedCollections, "climateTags", "Snow", [
    "Rain",
    "Snow"
  ]);

  assert.deepEqual(updated.collections, ["Travel", "Workwear"]);
  assert.deepEqual(updated.climateTags, ["Rain", "Snow"]);
});

test("removing one tag does not change collections or other selected tags", () => {
  const draftWithUnsavedCollections = {
    ...baseDraft,
    collections: ["Travel", "Workwear"],
    styleTags: ["Casual", "Formal", "Smart Casual"]
  };

  const updated = toggleItemEditorDraftTag(draftWithUnsavedCollections, "styleTags", "Formal", [
    "Casual",
    "Formal",
    "Smart Casual"
  ]);

  assert.deepEqual(updated.collections, ["Travel", "Workwear"]);
  assert.deepEqual(updated.styleTags, ["Casual", "Smart Casual"]);
});

test("patchOpenItemEditorDraft patches only the matching open draft", () => {
  const patched = patchOpenItemEditorDraft(baseDraft, "item-1", {
    favorite: true,
    updatedAt: "2026-06-11T10:00:00.000Z"
  });

  assert.equal(patched.favorite, true);
  assert.deepEqual(patched.styleTags, ["Casual"]);
  assert.deepEqual(patched.collections, ["Travel"]);

  assert.equal(
    patchOpenItemEditorDraft(baseDraft, "other-item", { favorite: true }),
    baseDraft
  );
});
