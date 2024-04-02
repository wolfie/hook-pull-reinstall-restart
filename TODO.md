- Accept also the `application/x-www-form-urlencoded` webhook payload
- Accept also empty webhook secrets
- Remove `SMEE_ID` env support
  - Step 1: Recognize ENV variable, warn and exit
  - Step 2: Remove from code
- Make sure that we're on `MAIN_BRANCH_NAME`

- [done 2024-02-04] Accept both full smee.io urls and only the alphanumeric part (this'll streamline the setup quite a bit)
