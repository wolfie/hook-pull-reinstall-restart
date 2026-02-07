# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hook-Pull-Reinstall-Restart is a simple CI/CD runner for personal projects. It listens for GitHub webhook events (via smee.io), then automatically pulls the latest changes, reinstalls dependencies, and restarts the application. This tool is designed for running apps on home servers without the complexity of Kubernetes or elaborate CI/CD pipelines.

## Development Commands

**Linting:**
```bash
npx eslint .
```

**Running the tool locally:**
```bash
node index.mjs
# or with flags:
node index.mjs --verbose
node index.mjs --envs --prod
```

**Testing the tool with itself:**
The repository uses itself for development. The `package.json` has `start` and `once` scripts that demonstrate the tool's functionality.

## Architecture

### Main Entry Point (`index.mjs`)

The main orchestrator that:
1. Validates git availability and detects package manager
2. Gets configuration (interactive prompts or environment variables)
3. Connects to smee.io for webhook events
4. Implements the main restart loop: kill process → pull → install → start
5. Handles `ONCE_SCRIPT` feature via file watching

**Critical flow:**
- On webhook event: validates signature → checks if push to main branch → triggers `restart()`
- `restart()`: kills existing child process → `git pull` → `npm/yarn/pnpm install` → spawn start script
- Uses `tree-kill` for proper process cleanup (kills entire process tree, not just parent)

### Key Modules

**`lib/spawn.mjs`**
- Wrapper around Node's `child_process.spawn`
- Prefixes stdout with 🔊 and stderr with ❗
- Returns both the child process and a promise that resolves on exit
- Merges environment variables properly

**`lib/smee/connectToSmee.mjs`**
- Connects to smee.io EventSource endpoint
- Transforms smee.io events into webhook format (headers + body)
- Returns a promise that resolves when connected or rejects on error

**`lib/getEnvs.mjs`**
- Handles two modes: interactive prompts or environment variables only
- Loads `.hprrrc` file as dotenv source
- Validates required environment variables
- Can create new smee.io channels automatically

**`lib/github/createIsValidBody.mjs`**
- Creates HMAC validator function for GitHub webhook signatures
- Uses `crypto.timingSafeEqual` to prevent timing attacks
- Validates `x-hub-signature-256` header against request body

**`lib/onFileChange.mjs`**
- Simple fs.watch wrapper that resolves on first file change
- Used for `ONCE_SCRIPT` trigger (watches `.hprrrc` file)

### Important Patterns

**Process Management:**
- Stores active child process in `spawnResult` variable
- Before restarting, checks if process already exited (`exitCode !== null`)
- Uses `tree-kill` with PID when available, falls back to `child.kill()`
- Implements 1-second timeout for process death, throws error if exceeded

**Shell Usage:**
- `USE_SHELL` constant (currently `true`) controls whether to spawn with shell
- When shell is enabled, commands are passed as single strings
- When disabled, uses parsed spawn args from `getScriptCommand()`

**Security:**
- Validates all webhook payloads using HMAC-SHA256 signature
- Rejects events without `x-hub-signature-256` header
- Only processes `push` events to configured main branch

**Configuration Priority:**
1. Command-line flags (`--envs`, `--prod`, `--verbose`)
2. Environment variables
3. `.hprrrc` file (loaded via dotenv)
4. Interactive prompts (fallback)

## Configuration File (`.hprrrc`)

Standard dotenv format containing:
- `EVENT_SOURCE_URL`: smee.io channel URL
- `GITHUB_WEBHOOK_SECRET`: webhook validation secret
- `MAIN_BRANCH_NAME`: branch that triggers restarts
- `START_SCRIPT`: script name from package.json (defaults to "start")
- `ONCE_SCRIPT`: optional script to run only once when file is touched

**Note:** This file contains the webhook secret in plaintext. It's gitignored but users should be warned not to reuse important passwords.

## Code Style

- ESLint 9 with flat config (`eslint.config.mjs`)
- Neostandard (flat-config successor to semistandard) + Prettier
- Uses JSDoc type annotations throughout (no TypeScript runtime)
- Emoji prefixes for different log types (✨ info, ❗ errors, 🔊 output, etc.)
- Async/await preferred over raw promises
