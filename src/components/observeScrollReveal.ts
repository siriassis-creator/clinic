const revealTargets = [
  '.login-card',
  '.overview-hero',
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
  const revealed = new WeakSet<Element>();
  const playing = new Set<Animation>();
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting || !root.contains(target) || revealed.has(target)) continue;
      observer.unobserve(target);
      revealed.add(target);
      if (reducedMotion.matches || target.contains(document.activeElement)) continue;

      const animation = target.animate(
        [{ opacity: 0.35, translate: '0 18px' }, { opacity: 1, translate: '0 0' }],
        { duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)' },
      );
      playing.add(animation);
      const forget = () => playing.delete(animation);
      animation.finished.then(forget, forget);
    }
  }, { rootMargin: '0px 0px -16px 0px' });

  const visitTargets = (element: Element, visit: (target: Element) => void) => {
    if (element.matches(revealTargets)) visit(element);
    element.querySelectorAll(revealTargets).forEach(visit);
  };

  const observe = (target: Element) => {
    if (root.contains(target) && !revealed.has(target) && !target.closest(excluded)) {
      observer.observe(target);
    }
  };

  const changes = new MutationObserver(records => {
    for (const record of records) {
      record.removedNodes.forEach(node => {
        if (node instanceof Element) {
          visitTargets(node, target => {
            if (!root.contains(target)) observer.unobserve(target);
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
