import test from "node:test";
import assert from "node:assert/strict";

import { createLibraryExportRow, serializeLibraryCsv } from "./libraryExport.js";

test("createLibraryExportRow maps library item metadata to export columns", () => {
  assert.deepEqual(
    createLibraryExportRow({
      id: "item_1",
      itemUuid: "uuid-1",
      name: "Field Jacket",
      brand: "Engineered Garments",
      garmentType: "Outerwear",
      layerType: "Outer",
      accessorySlot: "",
      type: "Jacket",
      color: "Olive",
      status: "Wardrobe",
      list: "Wardrobe",
      favorite: true,
      size: "M",
      weight: "Medium",
      quantity: 2,
      value: "180",
      retailValue: "340",
      collections: ["Travel", "Workwear"],
      styleTags: ["Casual", "Workwear"],
      climateTags: ["Rain", "Cold"],
      description: "Daily outer layer",
      importedAt: "2024-01-01T00:00:00.000Z",
      sourceOriginalFilename: "field-jacket.heic",
      sourceFileSize: 2456789,
      sourceLastModified: "2023-12-20T00:00:00.000Z",
      importSource: "file-upload",
      sourceNamespace: "local-file",
      sourceRelativePath: "imports/field-jacket.heic",
      relinkStatus: "available",
      sourceFileExtension: "heic",
      sourceMimeType: "image/heic",
      sourceAspectRatio: 0.75,
      sourceOrientation: "portrait",
      sourceCapturedAt: "2023-12-19T10:00:00.000Z",
      sourceOriginalCreatedAt: "2023-12-19T09:59:00.000Z",
      sourceCameraMake: "Canon",
      sourceCameraModel: "EOS R6",
      sourceLensModel: "RF28-70mm F2 L USM",
      originalPreserved: true,
      archivalOriginalPreserved: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      imageUrl: "/images/field-jacket.png",
      sourceImageWidth: 1200,
      sourceImageHeight: 1600
    }),
    {
      id: "item_1",
      itemUuid: "uuid-1",
      name: "Field Jacket",
      brand: "Engineered Garments",
      garment: "Outerwear",
      layerType: "Outer",
      accessorySlot: "",
      type: "Jacket",
      color: "Olive",
      status: "Wardrobe",
      list: "Wardrobe",
      favorite: "true",
      size: "M",
      weight: "Medium",
      quantity: "2",
      paid: "180",
      worth: "340",
      collections: "Travel|Workwear",
      styleTags: "Casual|Workwear",
      climateTags: "Rain|Cold",
      description: "Daily outer layer",
      importedAt: "2024-01-01T00:00:00.000Z",
      sourceOriginalFilename: "field-jacket.heic",
      sourceFileSize: "2456789",
      sourceImageWidth: "1200",
      sourceImageHeight: "1600",
      sourceLastModified: "2023-12-20T00:00:00.000Z",
      importSource: "file-upload",
      sourceNamespace: "local-file",
      sourceRelativePath: "imports/field-jacket.heic",
      relinkStatus: "available",
      sourceFileExtension: "heic",
      sourceMimeType: "image/heic",
      sourceAspectRatio: "0.75",
      sourceOrientation: "portrait",
      sourceCapturedAt: "2023-12-19T10:00:00.000Z",
      sourceOriginalCreatedAt: "2023-12-19T09:59:00.000Z",
      sourceCameraMake: "Canon",
      sourceCameraModel: "EOS R6",
      sourceLensModel: "RF28-70mm F2 L USM",
      originalPreserved: "true",
      archivalOriginalPreserved: "false",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      imageFilename: "field-jacket.png",
      imageWidth: "1200",
      imageHeight: "1600"
    }
  );
});

test("serializeLibraryCsv preserves empty values and blanks missing image dimensions", () => {
  const csv = serializeLibraryCsv([
    {
      id: "item_2",
      itemUuid: "",
      name: "",
      brand: "",
      garmentType: "",
      layerType: "",
      accessorySlot: "",
      type: "",
      color: "",
      status: "",
      list: "",
      favorite: false,
      size: "",
      weight: "",
      quantity: "",
      value: "",
      retailValue: "",
      collections: [],
      styleTags: [],
      climateTags: [],
      description: "",
      importedAt: "",
      sourceOriginalFilename: "",
      sourceFileSize: 0,
      sourceLastModified: "",
      importSource: "",
      sourceNamespace: "",
      sourceRelativePath: "",
      relinkStatus: "",
      sourceFileExtension: "",
      sourceMimeType: "",
      sourceAspectRatio: 0,
      sourceOrientation: "",
      sourceCapturedAt: "",
      sourceOriginalCreatedAt: "",
      sourceCameraMake: "",
      sourceCameraModel: "",
      sourceLensModel: "",
      originalPreserved: false,
      archivalOriginalPreserved: false,
      createdAt: "",
      updatedAt: "",
      imageUrl: "",
      sourceImageWidth: 0,
      sourceImageHeight: undefined
    }
  ]);

  const [headerLine, rowLine] = csv.split("\n");
  const headers = headerLine.split(",");
  const row = rowLine.split(",");
  const valuesByColumn = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));

  assert.equal(headers.length, row.length);
  assert.equal(valuesByColumn.id, "item_2");
  assert.equal(valuesByColumn.favorite, "false");
  assert.equal(valuesByColumn.originalPreserved, "false");
  assert.equal(valuesByColumn.archivalOriginalPreserved, "false");
  assert.equal(valuesByColumn.paid, "");
  assert.equal(valuesByColumn.worth, "");
  assert.equal(valuesByColumn.sourceFileSize, "");
  assert.equal(valuesByColumn.sourceAspectRatio, "");
  assert.equal(valuesByColumn.sourceImageWidth, "");
  assert.equal(valuesByColumn.sourceImageHeight, "");
  assert.equal(valuesByColumn.imageWidth, "");
  assert.equal(valuesByColumn.imageHeight, "");
});

test("serializeLibraryCsv preserves UTF-8 content and escapes commas quotes and line breaks", () => {
  assert.equal(
    serializeLibraryCsv([
      {
        id: "item_3",
        itemUuid: "uuid-3",
        name: "Été Shirt",
        brand: "Lemaire",
        garmentType: "Top",
        layerType: "Inner",
        type: "Shirt",
        color: "Crème",
        status: "Wishlist",
        list: "Wishlist",
        favorite: false,
        size: "48",
        weight: "Light",
        quantity: 1,
        value: "210",
        retailValue: "390",
        collections: ["Summer"],
        styleTags: ["Casual", "Summer"],
        climateTags: ["Warm"],
        description: "Soft, relaxed fit\nSays \"hello\"",
        createdAt: "2024-04-01T00:00:00.000Z",
        updatedAt: "2024-04-02T00:00:00.000Z",
        imageUrl: "/images/ete-shirt.png?version=2"
      }
    ]),
    "id,itemUuid,name,brand,garment,layerType,accessorySlot,type,color,status,list,favorite,size,weight,quantity,paid,worth,collections,styleTags,climateTags,description,importedAt,sourceOriginalFilename,sourceFileSize,sourceImageWidth,sourceImageHeight,sourceLastModified,importSource,sourceNamespace,sourceRelativePath,relinkStatus,sourceFileExtension,sourceMimeType,sourceAspectRatio,sourceOrientation,sourceCapturedAt,sourceOriginalCreatedAt,sourceCameraMake,sourceCameraModel,sourceLensModel,originalPreserved,archivalOriginalPreserved,createdAt,updatedAt,imageFilename,imageWidth,imageHeight\nitem_3,uuid-3,Été Shirt,Lemaire,Top,Inner,,Shirt,Crème,Wishlist,Wishlist,false,48,Light,1,210,390,Summer,Casual|Summer,Warm,\"Soft, relaxed fit\nSays \"\"hello\"\"\",,,,,,,,,,,,,,,,,,,,false,false,2024-04-01T00:00:00.000Z,2024-04-02T00:00:00.000Z,ete-shirt.png,,"
  );
});
