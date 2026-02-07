# 1.0.1

## Breaking Changes

- **BREAKING:** Changed `--prod`/`-p` flag to `--dev`/`-d` with inverted logic
- **BREAKING:** Changed `--envs`/`-e` flag to `--interactive`/`-i` with
- **BREAKING:** Generalized terminology from Smee-specific to vendor-neutral; `EVENT_SOURCE_URL` must be a full URL now
- **BREAKING:** Require Node 24 or later

## Features

- Upgrade to ESLint 10 with flat config system
- Add quality check npm scripts
- Added Claude-related files

# 0.0.6

- Trim all text inputs in prompts
- Add a `--verbose` flag
- Add support for running a command exactly once via the `ONCE_SCRIPT` environment variable

# 0.0.5

- Fix issue where processes that exit between restarts would lead to false errors

# 0.0.4

- Use `tree-kill` to robustly kill child process tree.
- Spawn a shell to execute commands. This gives more flexbility on which kinds of commands to execute with _seemingly_ small overhead.
- Start script is now re-evaluated always whenever service is restarted
- Support for other scripts than just `start` via `START_SCRIPT` environment variable

# 0.0.3

- Accept a complete smee.io URL as the channel ID
- Migrate `SMEE_ID` to `EVENT_SOURCE_URL`
- Rename `GITHUB_PROJECT_SECRET` to `GITHUB_WEBHOOK_SECRET`

# 0.0.2

- Initial release
