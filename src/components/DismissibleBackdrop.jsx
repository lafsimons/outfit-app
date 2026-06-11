import { useCallback, useRef } from "react";

import {
  didBackdropPointerDownStartOutside,
  shouldDismissFromBackdropClick
} from "../lib/backdropDismiss";

export default function DismissibleBackdrop({
  className,
  onDismiss,
  children
}) {
  const pointerDownStartedOutsideRef = useRef(false);

  const handlePointerDown = useCallback((event) => {
    pointerDownStartedOutsideRef.current = didBackdropPointerDownStartOutside(event);
  }, []);

  const handleClick = useCallback((event) => {
    const shouldDismiss = shouldDismissFromBackdropClick(event, pointerDownStartedOutsideRef.current);

    pointerDownStartedOutsideRef.current = false;

    if (!shouldDismiss) {
      return;
    }

    onDismiss(event);
  }, [onDismiss]);

  return (
    <div className={className} onPointerDown={handlePointerDown} onClick={handleClick}>
      {children}
    </div>
  );
}
