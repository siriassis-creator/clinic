# Clinic project notes

## 2026-11-04 — Vercel production deployment

- Target: Clinic project under Kitti account, team_1XjGuAFmiPolCBAWFJhOqBMQ. TIAN is separate.
- Deployment branch: codex/vercel-clinic-deploy. Main has not been changed.
- package.json and package-lock.json: align React, React DOM, React Is and React type packages to React 18 for react-thailand-address-typeahead compatibility. npm ci passes without a peer-dependency bypass.
- vercel.json: Vite build, dist output, SPA fallback to index.html.
- Validation: npm ci and npm run build passed. Bundle-size warning remains.
- Production commit: de0d9e9265cc05db026ecd9f64184c5e561eabd5. Deployment: dpl_Y6DkjYGW95qLvHFXwffE3stgDwrL, READY.
- Production URL: https://clinic-mu-steel.vercel.app
- Browser smoke check: login form renders with clinic name; direct navigation to /visits redirects to /login instead of returning 404.
- Existing Firebase project and data remain in use. Firebase security rules, authenticated patient flows and medication inventory correctness have not been verified by this deployment.
- Changes affect the shared React runtime and routing; patient and inventory logic were not edited. Authenticated regression testing remains necessary.
- Review/merge this branch before subsequent main-branch releases so the dependency fix and SPA routing are retained.

## 2026-11-04 — Bottom navigation

- Reference: Wowwash navigation in tms-transport/src/mobile-nav.css and App.tsx.
- src/components/Navbar.tsx: replace unused top navigation with persistent bottom links for home, patients, visits and pharmacy plus a native dialog for appointments, POS, reports and settings. Active state, keyboard focus, Escape and dialog dismissal supported. Correct visits route is /visits.
- src/components/Navbar.css: fixed bottom bar, stacked icons/labels on mobile, Clinic indigo active color, safe-area padding and content clearance. Dashboard height can expand so its contents remain reachable above the bar.
- src/App.tsx: mount navigation inside router only when authenticated, and reserve bottom content space. Login and route guards retained.
- Validation: npm run build passed; isolated component browser check at 390px confirmed primary navigation, opening More, selecting Reports and closing the dialog. Authenticated Firebase flows not tested.
- Scope: navigation/layout only; patient records, prescribing, stock and Firebase configuration unchanged.
