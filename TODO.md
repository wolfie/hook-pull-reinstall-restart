- Accept also the `application/x-www-form-urlencoded` webhook payload
- Accept also empty webhook secrets
- Make sure that we're on `MAIN_BRANCH_NAME`
- Restructure and refactor `getEnvs.mjs`

---

- [done 2024-02-04] Accept both full smee.io urls and only the alphanumeric part (this'll streamline the setup quite a bit)
- [done 2026-02-07] Remove `SMEE_ID` and `GITHUB_PROJECT_SECRET` deprecated env variables
- [done 2026-02-07] Delete `USE_SHELL` constant (now always enabled)
