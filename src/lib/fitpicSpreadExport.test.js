import test from "node:test";
import assert from "node:assert/strict";

import {
  FITPIC_SPREAD_DETAIL_GAP,
  FITPIC_SPREAD_DETAIL_ROW_HEIGHT,
  FITPIC_SPREAD_HIGH_QUALITY_SCALE,
  createFitpicSpreadExportOptions,
  getFitpicSpreadExportCardHeight,
  getFitpicSpreadExportDetailColumns,
  getFitpicSpreadExportDetailImages,
  getFitpicSpreadExportDetailLayout,
  getFitpicSpreadExportDetailRowCount,
  getFitpicSpreadExportDetailTiles,
  getFitpicSpreadExportOrderedFitpics,
  getFitpicSpreadExportPrimaryImage,
  getFitpicSpreadExportRenderConfig,
  getFitpicSpreadExportScopedFitpics,
  normalizeFitpicSpreadExportOptions
} from "./fitpicSpreadExport.js";

test("fitpic spread export presets keep reference as the default export mode", () => {
  assert.deepEqual(createFitpicSpreadExportOptions("compact"), {
    scope: "current",
    shuffleFitpics: false,
    useCurrentSortOrder: true,
    showTitle: true,
    showDetailGrid: false,
    showTags: false,
    showFitDate: false
  });

  assert.deepEqual(createFitpicSpreadExportOptions("reference"), {
    scope: "current",
    shuffleFitpics: false,
    useCurrentSortOrder: true,
    showTitle: true,
    showDetailGrid: true,
    showTags: false,
    showFitDate: false
  });
});

test("fitpic spread export primary image respects primaryImageUuid", () => {
  assert.deepEqual(
    getFitpicSpreadExportPrimaryImage({
      primaryImageUuid: "image-2",
      fitpicImages: [
        {
          fitpicImageUuid: "image-1",
          order: 0,
          images: { original: "/images/front.jpg" }
        },
        {
          fitpicImageUuid: "image-2",
          order: 1,
          images: { original: "/images/detail.jpg" }
        }
      ]
    }),
    {
      fitpicImageUuid: "image-2",
      order: 1,
      src: "/images/detail.jpg"
    }
  );
});

test("fitpic spread export detail images exclude the primary image", () => {
  assert.deepEqual(
    getFitpicSpreadExportDetailImages({
      primaryImageUuid: "image-1",
      fitpicImages: [
        {
          fitpicImageUuid: "image-1",
          order: 0,
          images: { original: "/images/front.jpg" }
        },
        {
          fitpicImageUuid: "image-2",
          order: 1,
          images: { original: "/images/detail.jpg" }
        }
      ]
    }),
    [
      {
        fitpicImageUuid: "image-2",
        order: 1,
        src: "/images/detail.jpg"
      }
    ]
  );
});

test("fitpic spread export detail tiles limit to eight images plus overflow tile", () => {
  const fitpic = {
    primaryImageUuid: "image-1",
    fitpicImages: Array.from({ length: 11 }, (_, index) => ({
      fitpicImageUuid: `image-${index + 1}`,
      order: index,
      images: { original: `/images/${index + 1}.jpg` }
    }))
  };

  const tiles = getFitpicSpreadExportDetailTiles(fitpic);

  assert.equal(tiles.length, 9);
  assert.deepEqual(tiles[0], {
    kind: "image",
    fitpicImageUuid: "image-2",
    src: "/images/2.jpg"
  });
  assert.deepEqual(tiles[8], {
    kind: "overflow",
    overflowCount: 2
  });
  assert.equal(getFitpicSpreadExportDetailRowCount(fitpic), 3);
});

test("fitpic spread export detail layout adapts for one, two, and three images", () => {
  assert.equal(getFitpicSpreadExportDetailColumns(1), 1);
  assert.equal(getFitpicSpreadExportDetailColumns(2), 2);
  assert.equal(getFitpicSpreadExportDetailColumns(3), 3);

  assert.deepEqual(
    getFitpicSpreadExportDetailLayout(1, 276),
    {
      columns: 1,
      rowCount: 1,
      frames: [{ x: 0, y: 0, width: 276, height: FITPIC_SPREAD_DETAIL_ROW_HEIGHT }],
      totalHeight: FITPIC_SPREAD_DETAIL_ROW_HEIGHT
    }
  );

  assert.deepEqual(
    getFitpicSpreadExportDetailLayout(2, 276),
    {
      columns: 2,
      rowCount: 1,
      frames: [
        { x: 0, y: 0, width: 136, height: FITPIC_SPREAD_DETAIL_ROW_HEIGHT },
        { x: 140, y: 0, width: 136, height: FITPIC_SPREAD_DETAIL_ROW_HEIGHT }
      ],
      totalHeight: FITPIC_SPREAD_DETAIL_ROW_HEIGHT
    }
  );

  const threeImageLayout = getFitpicSpreadExportDetailLayout(3, 276);
  assert.equal(threeImageLayout.columns, 3);
  assert.equal(threeImageLayout.rowCount, 1);
  assert.equal(threeImageLayout.frames.length, 3);
  assert.equal(threeImageLayout.frames[1].x, threeImageLayout.frames[0].width + FITPIC_SPREAD_DETAIL_GAP);
});

test("fitpic spread export scope supports current filtered results and all fitpics", () => {
  const allFitpics = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const visibleFitpics = [{ id: "b" }];
  const sortedFitpics = [{ id: "c" }, { id: "b" }, { id: "a" }];

  assert.deepEqual(
    getFitpicSpreadExportScopedFitpics({
      allFitpics,
      visibleFitpics,
      sortedFitpics,
      options: { scope: "current", useCurrentSortOrder: true }
    }).map((fitpic) => fitpic.id),
    ["b"]
  );

  assert.deepEqual(
    getFitpicSpreadExportScopedFitpics({
      allFitpics,
      visibleFitpics,
      sortedFitpics,
      options: { scope: "all", useCurrentSortOrder: true }
    }).map((fitpic) => fitpic.id),
    ["c", "b", "a"]
  );
});

test("fitpic spread export ordered fitpics preserve or shuffle order by option", () => {
  const fitpics = [{ id: "first" }, { id: "second" }, { id: "third" }, { id: "fourth" }];

  assert.deepEqual(
    getFitpicSpreadExportOrderedFitpics(fitpics, { shuffleFitpics: false }).map((fitpic) => fitpic.id),
    ["first", "second", "third", "fourth"]
  );

  let randomIndex = 0;
  const randomValues = [0.4, 0.1, 0.8];

  assert.notDeepEqual(
    getFitpicSpreadExportOrderedFitpics(fitpics, { shuffleFitpics: true, useCurrentSortOrder: false }, () => randomValues[randomIndex++])
      .map((fitpic) => fitpic.id),
    ["first", "second", "third", "fourth"]
  );
});

test("fitpic spread export render config scales from the default card layout", () => {
  const cardHeight = getFitpicSpreadExportCardHeight(createFitpicSpreadExportOptions("reference"));
  const config = getFitpicSpreadExportRenderConfig(12, { cardHeight });

  assert.equal(config.qualityScale, FITPIC_SPREAD_HIGH_QUALITY_SCALE);
  assert.equal(config.exportScale, FITPIC_SPREAD_HIGH_QUALITY_SCALE);
  assert.equal(config.columns, 4);
  assert.equal(config.rows, 3);
  assert.ok(config.canvasWidth > 0);
  assert.ok(config.canvasHeight > 0);
  assert.ok(cardHeight > FITPIC_SPREAD_DETAIL_ROW_HEIGHT * 3);
});

test("fitpic spread export option normalization keeps sort and shuffle mutually exclusive", () => {
  assert.deepEqual(
    normalizeFitpicSpreadExportOptions({
      scope: "all",
      useCurrentSortOrder: true,
      shuffleFitpics: true
    }),
    {
      ...createFitpicSpreadExportOptions("reference"),
      scope: "all",
      useCurrentSortOrder: true,
      shuffleFitpics: false
    }
  );
});
