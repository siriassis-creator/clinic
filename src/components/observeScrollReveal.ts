const revealTargets = [
  '.login-card',
  '.overview-hero',
  '.overview-toolbar',
  '.overview-stat',
  '.overview-panel',
  '.reg-header',
  '.reg-section',
  '.table-container',
  '.workspace-header',
  '.workspace-empty',
  '.report-top-bar',
  '.stat-card-new',
  '.main-chart-full',
  '.data-table-card',
].join(', ');

const excluded = '.modal-overlay, .modal-content, dialog, [role="dialog"], [role="alertdialog"]';

export function observeScrollReveal(root: HTMLElement) {
  if (!('IntersectionObserver' in window) || !('animate' in Element.prototype)) {
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const inView = new WeakSet<Element>();
  const playing = new Map<Element, Animation>();
  const observer = new IntersectionObserver(entries => {
    let dashboardDelay = 0;
    for (const { target, isIntersecting, intersectionRatio } of entries) {
      if (!root.contains(target)) continue;
      const dashboard = target.closest('.clinic-overview');
      if (!isIntersecting || (dashboard && intersectionRatio < 0.01)) {
        inView.delete(target);
        continue;
      }
      // Wait until the card is visibly inside the viewport, above the bottom bar.
      if ((dashboard && intersectionRatio < 0.15) || inView.has(target)) continue;
      inView.add(target);

      // Translation can briefly move a card across the viewport edge during playback.
      if (playing.has(target) || reducedMotion.matches || target.contains(document.activeElement)) continue;

      const delay = dashboard ? Math.min(dashboardDelay++ * 80, 320) : 0;
      const animation = target.animate(
        [{ opacity: dashboard ? 0 : 0.35, transform: dashboard ? 'translateY(38px)' : 'translateY(18px)' },
          { opacity: 1, transform: 'translateY(0)' }],
        {
          duration: dashboard ? 740 : 420,
          delay,
          fill: 'backwards',
          easing: 'cubic-bezier(.2,.75,.25,1)',
        },
      );
      playing.set(target, animation);
      const forget = () => {
        if (playing.get(target) === animation) playing.delete(target);
      };
      animation.finished.then(forget, forget);
    }
  }, { rootMargin: '0px 0px -72px 0px', threshold: [0, 0.01, 0.15] });

  const visitTargets = (element: Element, visit: (target: Element) => void) => {
    if (element.matches(revealTargets)) visit(element);
    element.querySelectorAll(revealTargets).forEach(visit);
  };

  const observe = (target: Element) => {
    if (root.contains(target) && !target.closest(excluded)) {
      observer.observe(target);
    }
  };

  const changes = new MutationObserver(records => {
    for (const record of records) {
      record.removedNodes.forEach(node => {
        if (node instanceof Element) {
          visitTargets(node, target => {
            if (!root.contains(target)) {
              observer.unobserve(target);
              inView.delete(target);
              playing.get(target)?.cancel();
              playing.delete(target);
            }
          });
        }
      });
      record.addedNodes.forEach(node => {
        if (node instanceof Element) visitTargets(node, observe);
      });
    }
  });
  visitTargets(root, observe);
  changes.observe(root, { childList: true, subtree: true });

  const stopMotion = () => {
    if (reducedMotion.matches) playing.forEach(animation => animation.cancel());
  };
  reducedMotion.addEventListener('change', stopMotion);

  return () => {
    changes.disconnect();
    observer.disconnect();
    reducedMotion.removeEventListener('change', stopMotion);
    playing.forEach(animation => animation.cancel());
  };
}
