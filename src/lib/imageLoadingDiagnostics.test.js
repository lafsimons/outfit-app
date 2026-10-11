import test from "node:test";
import assert from "node:assert/strict";
import { describeImageSource, getImageTraceReport, recordImageTrace, startImageTrace, stopImageTrace } from "./imageLoadingDiagnostics.js";

test("image traces are opt-in, bounded, resettable and stop recording", () => {
  recordImageTrace("ignored");
  assert.equal(getImageTraceReport().events.length, 0);
  startImageTrace();
  for (let index = 0; index < 450; index += 1) recordImageTrace("event", { index });
  assert.equal(getImageTraceReport().events.length, 400);
  assert.equal(getImageTraceReport().events.at(-1).index, 449);
  stopImageTrace();
  const count = getImageTraceReport().events.length;
  recordImageTrace("ignored");
  assert.equal(getImageTraceReport().events.length, count);
  startImageTrace();
  assert.deepEqual(getImageTraceReport().events.map(event => event.type), ["trace-start"]);
  stopImageTrace();
});

test("image source diagnostics omit bytes, credentials, queries and directory paths", () => {
  const dataUrl = "data:image/png;base64,SECRET";
  assert.deepEqual(describeImageSource(dataUrl), { kind: "data", length: dataUrl.length });
  assert.deepEqual(describeImageSource("https://user:secret@example.com/private/pants.png?token=SECRET#secret"), { kind: "remote", filename: "pants.png" });
  assert.deepEqual(describeImageSource("blob:https://example.com/private-id"), { kind: "blob" });
});
