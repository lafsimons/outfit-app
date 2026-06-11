export function didBackdropPointerDownStartOutside(event) {
  return event.target === event.currentTarget;
}

export function shouldDismissFromBackdropClick(event, pointerDownStartedOutside) {
  if (event.target !== event.currentTarget) {
    return false;
  }

  return pointerDownStartedOutside;
}
