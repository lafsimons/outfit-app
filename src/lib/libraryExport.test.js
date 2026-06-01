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
      type: "Jacket",
      color: "Olive",
      list: "Wardrobe",
      favorite: true,
      size: "M",
      weight: "Medium",
      quantity: 2,
      styleTags: ["Casual", "Workwear"],
      climateTags: ["Rain", "Cold"],
      description: "Daily outer layer",
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
      type: "Jacket",
      color: "Olive",
      status: "Wardrobe",
      favorite: "true",
      size: "M",
      weight: "Medium",
      quantity: "2",
      styleTags: "Casual|Workwear",
      climateTags: "Rain|Cold",
      description: "Daily outer layer",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      imageFilename: "field-jacket.png",
      imageWidth: "1200",
      imageHeight: "1600"
    }
  );
});

test("serializeLibraryCsv preserves empty values and blanks missing image dimensions", () => {
  assert.equal(
    serializeLibraryCsv([
      {
        id: "item_2",
        itemUuid: "",
        name: "",
        brand: "",
        garmentType: "",
        type: "",
        color: "",
        list: "",
        favorite: false,
        size: "",
        weight: "",
        quantity: "",
        styleTags: [],
        climateTags: [],
        description: "",
        createdAt: "",
        updatedAt: "",
        imageUrl: "",
        sourceImageWidth: 0,
        sourceImageHeight: undefined
      }
    ]),
    "id,itemUuid,name,brand,garment,type,color,status,favorite,size,weight,quantity,styleTags,climateTags,description,createdAt,updatedAt,imageFilename,imageWidth,imageHeight\nitem_2,,,,,,,,false,,,,,,,,,,,"
  );
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
        type: "Shirt",
        color: "Crème",
        list: "Wishlist",
        favorite: false,
        size: "48",
        weight: "Light",
        quantity: 1,
        styleTags: ["Casual", "Summer"],
        climateTags: ["Warm"],
        description: "Soft, relaxed fit\nSays \"hello\"",
        createdAt: "2024-04-01T00:00:00.000Z",
        updatedAt: "2024-04-02T00:00:00.000Z",
        imageUrl: "/images/ete-shirt.png?version=2"
      }
    ]),
    "id,itemUuid,name,brand,garment,type,color,status,favorite,size,weight,quantity,styleTags,climateTags,description,createdAt,updatedAt,imageFilename,imageWidth,imageHeight\nitem_3,uuid-3,Été Shirt,Lemaire,Top,Shirt,Crème,Wishlist,false,48,Light,1,Casual|Summer,Warm,\"Soft, relaxed fit\nSays \"\"hello\"\"\",2024-04-01T00:00:00.000Z,2024-04-02T00:00:00.000Z,ete-shirt.png,,"
  );
});
