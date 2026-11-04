# Clinic project notes

## 2026-11-04 — Vercel deployment

- Target: Clinic project under Kitti account, team_1XjGuAFmiPolCBAWFJhOqBMQ. TIAN is separate.
- Deployment branch: codex/vercel-clinic-deploy. Main has not been changed.
- package.json and package-lock.json: align React, React DOM, React Is and React type packages to React 18 for react-thailand-address-typeahead compatibility; npm ci passes without peer-dependency bypass.
- vercel.json: Vite build, dist output, SPA fallback to index.html.
- Validation: npm ci and npm run build passed. Bundle-size warning remains.
- Production build submitted at commit de0d9e9265cc05db026ecd9f64184c5e561eabd5, deployment dpl_Y6DkjYGW95qLvHFXwffE3stgDwrL. Final remote status must be checked in Vercel.
- Existing Firebase project and data remain in use; Firebase rules, authenticated patient flows and medication inventory correctness have not been verified by this deployment.
- Before subsequent main-branch releases, merge/review the deployment branch changes so the dependency fix and SPA routing are retained.
