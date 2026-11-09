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
  const revealed = new WeakSet<Element>();
  const playing = new Set<Animation>();
  const observer = new IntersectionObserver(entries => {
    let dashboardDelay = 0;
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting || !root.contains(target) || revealed.has(target)) continue;
      observer.unobserve(target);
      revealed.add(target);
      if (reducedMotion.matches || target.contains(document.activeElement)) continue;

      const dashboard = target.closest('.clinic-overview');
      const delay = dashboard ? Math.min(dashboardDelay++ * 65, 260) : 0;
      const animation = target.animate(
        [{ opacity: dashboard ? 0 : 0.35, translate: dashboard ? '0 34px' : '0 18px' },
          { opacity: 1, translate: '0 0' }],
        {
          duration: dashboard ? 650 : 420,
          delay,
          fill: 'backwards',
          easing: 'cubic-bezier(.2,.75,.25,1)',
        },
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
    if (root.contains(target) && !revealed.has(target) && !target.closest(excluded) && !target.closest('[data-reveal-wait]')) {
      observer.observe(target);
    }
  };

  const changes = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof Element) {
        visitTargets(record.target, observe);
        continue;
      }
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
  changes.observe(root, { childList: true, subtree: true, attributeFilter: ['data-reveal-wait'] });

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
