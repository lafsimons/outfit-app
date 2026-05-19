import test from "node:test";
import assert from "node:assert/strict";

import { normalizeImportMetadataFields, readImageFileMetadata } from "./importMetadata.js";

test("normalizeImportMetadataFields applies safe defaults and importedAt fallback", () => {
  assert.deepEqual(
    normalizeImportMetadataFields(
      {
        sourceOriginalFilename: 123,
        sourceFileSize: "bad",
        sourceImageWidth: -10,
        sourceImageHeight: null,
        sourceLastModified: "not-a-date",
        importSource: "  ",
        sourceNamespace: null,
        sourceRelativePath: 42,
        relinkStatus: "   "
      },
      "2024-01-02T03:04:05.000Z"
    ),
    {
      importedAt: "2024-01-02T03:04:05.000Z",
      sourceOriginalFilename: "",
      sourceFileSize: 0,
      sourceImageWidth: 0,
      sourceImageHeight: 0,
      sourceLastModified: "",
      importSource: "",
      sourceNamespace: "",
      sourceRelativePath: "",
      relinkStatus: "unknown"
    }
  );
});

test("readImageFileMetadata captures file provenance before compression", async () => {
  const file = {
    name: "IMG_2048.HEIC",
    size: 5123456,
    lastModified: 1710000000000
  };

  const metadata = await readImageFileMetadata(file, {
    now: () => "2024-05-01T12:34:56.000Z",
    readFileAsDataUrl: async (value) => {
      assert.equal(value, file);
      return "data:image/heic;base64,raw";
    },
    loadImage: async (dataUrl) => {
      assert.equal(dataUrl, "data:image/heic;base64,raw");
      return {
        naturalWidth: 3024,
        naturalHeight: 4032
      };
    }
  });

  assert.deepEqual(metadata, {
    importedAt: "2024-05-01T12:34:56.000Z",
    sourceOriginalFilename: "IMG_2048.HEIC",
    sourceFileSize: 5123456,
    sourceImageWidth: 3024,
    sourceImageHeight: 4032,
    sourceLastModified: "2024-03-09T16:00:00.000Z",
    importSource: "file-upload",
    sourceNamespace: "local-file",
    sourceRelativePath: "IMG_2048.HEIC",
    relinkStatus: "available"
  });
});
