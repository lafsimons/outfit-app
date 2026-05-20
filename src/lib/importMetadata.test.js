import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeExtendedImageMetadataFields,
  normalizeImportMetadataFields,
  readImageFileMetadata
} from "./importMetadata.js";

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
    lastModified: 1710000000000,
    type: "image/heic"
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
    },
    readAdditionalMetadata: async (value, { width, height }) => {
      assert.equal(value, file);
      assert.equal(width, 3024);
      assert.equal(height, 4032);

      return {
        sourceOriginalCreatedAt: "2024-02-10T09:08:07.000Z",
        sourceCameraMake: "Canon",
        sourceCameraModel: "EOS R6",
        sourceLensModel: "RF28-70mm F2 L USM"
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
    relinkStatus: "available",
    sourceFileExtension: "heic",
    sourceMimeType: "image/heic",
    sourceAspectRatio: 0.75,
    sourceOrientation: "portrait",
    sourceCapturedAt: "",
    sourceOriginalCreatedAt: "2024-02-10T09:08:07.000Z",
    sourceCameraMake: "Canon",
    sourceCameraModel: "EOS R6",
    sourceLensModel: "RF28-70mm F2 L USM"
  });
});

test("normalizeExtendedImageMetadataFields applies safe defaults", () => {
  assert.deepEqual(
    normalizeExtendedImageMetadataFields({
      sourceFileExtension: ".JPG",
      sourceMimeType: 42,
      sourceAspectRatio: "-1",
      sourceOrientation: "  ",
      sourceCapturedAt: "bad",
      sourceOriginalCreatedAt: 1710000000000,
      sourceCameraMake: null,
      sourceCameraModel: "Rolleiflex",
      sourceLensModel: {}
    }),
    {
      sourceFileExtension: "jpg",
      sourceMimeType: "",
      sourceAspectRatio: 0,
      sourceOrientation: "unknown",
      sourceCapturedAt: "",
      sourceOriginalCreatedAt: "2024-03-09T16:00:00.000Z",
      sourceCameraMake: "",
      sourceCameraModel: "Rolleiflex",
      sourceLensModel: ""
    }
  );
});
