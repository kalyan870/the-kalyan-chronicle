export function runViewTransition(updateDom: () => void): void {
  if (typeof document === 'undefined') {
    updateDom();
    return;
  }

  const prefersReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const docWithTransition = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };

  if (!prefersReduced && typeof docWithTransition.startViewTransition === 'function') {
    try {
      docWithTransition.startViewTransition(() => {
        updateDom();
      });
      return;
    } catch {
      // Fall back to synchronous update if browser rejects transition
    }
  }

  updateDom();
}
