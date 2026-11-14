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

## 2026-11-04 — Medicine favicon

- public/pill-favicon.svg: new scalable capsule icon in Clinic indigo/white, with a pale background for small browser tabs.
- index.html: point favicon to the new filename to avoid reuse of the old cached icon.
- Scope: browser favicon only; application screens and data logic unchanged.

## 2026-11-04 — Patient case workspace

- Visits.tsx and VisitWorkspace.css: separate persistent patient tabs, searchable opening, duplicate-patient resume, hide/reopen tabs, database drafts with visible save/error state, and restore unfinished cases for the signed-in account.
- visitWorkflow.ts: deterministic active draft ID per owner/patient, revision checks to prevent stale overwrites; draft -> awaiting_medicine -> awaiting_payment -> paid. Completion validates quantities/prices; dispensing checks current stock/expiry and writes stock plus medicine_history atomically. Payment archives once and removes the active draft atomically. Completed history is read-only from Visits.
- Reports.tsx: new workflow cases count toward income only after paid, using paidAt; legacy visits/POS retain prior behavior. Report patient/Dx/medicine statistics for new cases currently follow the paid-case reporting set.
- Dashboard.tsx and Appointments.tsx: exclude draft appointments from reminders.
- Tests: node --test tests/visit-workflow.test.mjs passes 3 suites covering separate drafts, stale writes, insufficient stock rollback, single dispense/payment, archive and reopening, invalid prescriptions. Transaction tests use a serialized atomic mock, not a Firestore emulator.
- Browser QA: two synthetic patients opened; distinct forms; switching back preserved the first patient's complaint. No production patient data used. Temporary mock files/config were removed before build.
- npm run build passes. Existing bundle-size warning remains.
- Limitations: live Firebase authentication/rules and multi-device behavior require validation with an authorized clinic account. Existing legacy/POS stock mutations remain outside these new transactions. Drafts are scoped to the signed-in user. No automatic drug selection or diagnosis.

## 2026-11-04 — Full-screen page layout

- src/fullscreen.css: consistent full-width page canvas and minimum viewport height after bottom-navigation clearance; remove room and Settings width caps, allow Dashboard/page scrolling, retain safe-area spacing, responsive form wrapping and horizontal table scrolling. Dialogs keep their own width limits. Login canvas fills the viewport while the form stays readable.
- src/main.tsx: load the shared layout after page/component styles.
- Scope: layout only; data, drafts, dispensing, payments and authentication unchanged.
- Validation: npm run build. Authenticated screens require signed-in visual verification.

## 2026-11-04 — Management summary dashboard

- Dashboard.tsx / Dashboard.css: replace large menu cards with a blue clinical overview inspired by the provided reference. Banner, six summary metrics, today's appointments, seven-day treatment/new-patient trend, recent patients, inventory donut, low/expired stock alerts, diagnosis ranking, recent visits, six-month income/stock-receipt chart and active-case counts. Responsive desktop grid/mobile stack. Bottom navigation unchanged; no sidebar added.
- dashboardSummary.ts: Bangkok-local date aggregation; exclude drafts and walk-in POS from clinical counts, count workflow revenue only after payment, preserve legacy revenue behavior. Active-case counts are scoped to the current account. Stock donut buckets are mutually exclusive. Receipt cost explicitly labelled approximate from recorded/current medicine cost, not total accounting expense.
- Live Firestore listeners with cleanup; visible loading, source errors and empty states. Patient search and month selector work locally with real loaded data. No fabricated growth percentages, appointment times or sample records in production.
- tests/dashboard-summary.test.mjs: 2 tests pass for Thai date boundary, draft/payment semantics, stock categories, user scoping and empty data. Production build passes; existing bundle-size warning remains.
- Browser QA: dashboard and bottom menu render at desktop and 390px using isolated synthetic fixtures. Temporary fixtures and aliases removed before build. Live authenticated Firebase data not independently tested.
- Scope: summary UI/read-only aggregation; patient, stock mutation, payment, login and navigation logic retained.

## 2026-11-04 — Standard patient avatars

- PatientAvatar.tsx / PatientAvatar.css: reusable local SVG person portraits replacing initial letters in latest registrations and appointments, and activity dots in recent visits. Patient names remain visible. No photos uploaded or external image services used.
- patientAvatar.ts: age bands 0–12 child, 13–19 teen, 20–59 adult, 60+ senior; use valid birthDate calculated in Bangkok time, otherwise validated recorded age. Gender uses explicit Thai male/female values; unknown values use a neutral standard. Unknown ages use a generic silhouette. Portraits are illustrations, not real patient photos or identity verification.
- Dashboard.tsx: resolve visit patient by patientId first, then unique CN; ambiguous/missing matches fall back to available snapshot or generic avatar, never name-based inference.
- Tests: 2 groups pass for age thresholds, blank/malformed information, birthday rollover, gender fallback and ID/CN matching. Build passes. UI scope only; patient records and bottom navigation unchanged.

## 2026-11-04 — 3D nurse hero portrait

- User explicitly authorized publication of the generated cartoon likeness to this public GitHub repository and the Clinic website.
- public/images/clinic-nurse-hero-3d.webp: optimized transparent 3D cartoon nurse facing right, half-body crossed-arms pose, based on the user-provided reference. The source photograph is not uploaded.
- Dashboard.tsx: place the nurse beside the clinic name in the existing hero, replacing the decorative medical cross.
- Dashboard.css: responsive portrait sizing on desktop, tablet and mobile; preserve bottom navigation and other dashboard content.
- Validation: npm run build passed. Generated PNG alpha verified before conversion to WebP. No changes to data, authentication, payment or stock behavior.

## 2026-11-04 — Nurse placement adjustment

- Dashboard.tsx: move the approved 3D nurse immediately adjacent to the clinic-name heading; restore the original decorative medical cross alongside the banner.
- Dashboard.css: compact inline name/portrait layout at desktop/mobile sizes; preserve original decorative-art responsiveness and bottom navigation.
- Validation: production build. No data or workflow changes.


## 2026-11-04 — Approved full-height nurse hero
- Files: src/pages/Dashboard.tsx, src/pages/Dashboard.css.
- Replaced small nurse beside clinic name with one full-height nurse in the approved position. Enlarged medical cross as faint watermark behind nurse. Removed PATIENT CARE text and decorative line.
- Preserved clinic copy, four feature cards and bottom navigation. Responsive art sizing for tablet/mobile; no database or workflow changes.
- Validation: TypeScript/Vite production build; production deployment to Kitti's Clinic project requested.


## 2026-11-09 — Dashboard card order
- Dashboard.tsx replaces the former inventory slot with today's registrations and moves the inventory chart into the former alerts slot.
- dashboardSummary.ts filters today's registrations by Bangkok date, independently of the month filter. Existing recent registrations and inventory totals are retained.


## 2026-11-09 — Scroll Reveal
- App.tsx connects a shared viewport observer for all routes, including login.
- observeScrollReveal.ts animates content sections once on entry, handles dynamically mounted sections, excludes dialogs and honors reduced motion.


## Dashboard reveal timing
- Dashboard cards wait for the initial data snapshots before revealing. Dashboard sections slide farther and use a short stagger, while respecting reduced motion.


## Repeat Scroll Reveal
- Shared observer keeps sections registered and replays when they leave and return to view. An active animation cannot restart itself near a viewport edge.


## Dashboard loading and card reveal
- Dashboard cards and chart panels reveal on viewport entry independently of Firestore loading. Each panel renders when its own collections are available, with loading and error states.
- Dashboard charts use the shared card reveal instead of running a second chart animation on data updates.


## Dashboard reveal visibility
- Dashboard reveal starts at 15% visibility above the bottom menu, and resets below 1% to handle viewport edge contact. Uses transform-based animation.
- Browser fixture confirmed the overview heading, summary card, and chart panels replay after leaving and re-entering the viewport.


## Directional menu transition
- Navbar animates the incoming route from the side matching menu order and slides a blue indicator along the bottom nav. Reduced-motion preference disables movement.
- App passes the page container to Navbar so the fixed navigation stays in place.


## Patient page stacking
- fullscreen.css isolates page content below the fixed bottom navigation, including the high-z-index address suggestions. Native dialogs retain their top-layer behavior.


## Card Lift menu transition
- Navbar now fades and lifts the incoming page vertically, matching the direction of Scroll Reveal. The menu indicator and reduced-motion behavior are retained.


## Dashboard and visit workflow updates
- Dashboard displays unique patients and clinical visits for the selected month. Settings defines the expiry warning window (default 30 Bangkok calendar days), used by dashboard inventory and pharmacy badges.
- Confirming cancellation of a pre-dispensing tab transactionally removes its draft. Dispensed and paid records are protected, and writes check episode IDs to avoid overwriting a newly reopened case.
- Chronic conditions and drug allergies are displayed directly below patient CN and age.


## Dashboard refresh controls
- Dashboard uses one-shot server reads only on refresh or an opted-in page entry. The last successful snapshot stays in memory across route changes and is cleared on account change/sign-out. Only the toggle preference is stored locally.
- Refresh failures preserve prior data and its Bangkok timestamp. Concurrent refreshes share one request.


## Dashboard toggle styling
- Style the existing auto-refresh switch with an animated thumb, visible keyboard focus and reduced-motion support.
