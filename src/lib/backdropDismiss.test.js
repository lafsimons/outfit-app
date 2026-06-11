import test from "node:test";
import assert from "node:assert/strict";

import {
  didBackdropPointerDownStartOutside,
  shouldDismissFromBackdropClick
} from "./backdropDismiss.js";

test("backdrop dismissal starts only when pointerdown begins on the backdrop", () => {
  const backdrop = {};
  const modal = {};

  assert.equal(
    didBackdropPointerDownStartOutside({
      target: backdrop,
      currentTarget: backdrop
    }),
    true
  );

  assert.equal(
    didBackdropPointerDownStartOutside({
      target: modal,
      currentTarget: backdrop
    }),
    false
  );
});

test("backdrop click dismissal requires an outside-origin pointer sequence", () => {
  const backdrop = {};
  const modal = {};

  assert.equal(
    shouldDismissFromBackdropClick(
      {
        target: backdrop,
        currentTarget: backdrop
      },
      true
    ),
    true
  );

  assert.equal(
    shouldDismissFromBackdropClick(
      {
        target: backdrop,
        currentTarget: backdrop
      },
      false
    ),
    false
  );

  assert.equal(
    shouldDismissFromBackdropClick(
      {
        target: modal,
        currentTarget: backdrop
      },
      true
    ),
    false
  );
});
