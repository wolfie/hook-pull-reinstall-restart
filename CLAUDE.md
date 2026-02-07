# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hook-Pull-Reinstall-Restart is a simple CI/CD runner for personal projects. It listens for GitHub webhook events (via an event source proxy like smee.io), then automatically pulls the latest changes, reinstalls dependencies, and restarts the application. This tool is designed for running apps on home servers without the complexity of Kubernetes or elaborate CI/CD pipelines.

## Development Commands

**Linting:**

```bash
npx eslint .
```

**Type checking:**

```bash
npx tsc --noEmit
```

**Running the tool locally:**

```bash
node index.ts
# or with flags:
node index.ts --verbose
node index.ts --interactive --dev
```

**Testing the tool with itself:**
The repository uses itself for development. The `package.json` has `start` and `once` scripts that demonstrate the tool's functionality.

## Architecture

### Main Entry Point (`index.ts`)

The main orchestrator that:

1. Validates git availability and detects package manager
2. Gets configuration (interactive prompts or environment variables)
3. Connects to event source for webhook events
4. Implements the main restart loop: kill process → pull → install → start
5. Handles `ONCE_SCRIPT` feature via file watching

**Critical flow:**

- On webhook event: validates signature → checks if push to main branch → triggers `restart()`
- `restart()`: kills existing child process → `git pull` → `npm/yarn/pnpm install` → spawn start script
- Uses `tree-kill` for proper process cleanup (kills entire process tree, not just parent)

### Key Modules

**`lib/spawn.ts`**

- Wrapper around Node's `child_process.spawn`
- Prefixes stdout with 🔊 and stderr with ❗
- Returns both the child process and a promise that resolves on exit
- Merges environment variables properly

**`lib/smee/connectToSmee.ts`**

- Connects to event source endpoint (default implementation uses smee.io)
- Transforms event source messages into webhook format (headers + body)
- Returns a promise that resolves when connected or rejects on error

**`lib/getEnvs.ts`**

- Handles two modes: interactive prompts or environment variables only
- Loads `.hprrrc` file as dotenv source
- Validates required environment variables
- Can create new event source channels automatically (via smee.io by default)

**`lib/github/createIsValidBody.ts`**

- Creates HMAC validator function for GitHub webhook signatures
- Uses `crypto.timingSafeEqual` to prevent timing attacks
- Validates `x-hub-signature-256` header against request body

**`lib/onFileChange.ts`**

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

1. Command-line flags (`--interactive`, `--dev`, `--verbose`)
2. `.hprrrc` file (loaded via dotenv) and environment variables
3. Interactive prompts (fallback when `.hprrrc` is missing or `--interactive` is used)

## Configuration File (`.hprrrc`)

Standard dotenv format containing:

- `EVENT_SOURCE_URL`: Event source URL (e.g., smee.io channel URL)
- `GITHUB_WEBHOOK_SECRET`: webhook validation secret
- `MAIN_BRANCH_NAME`: branch that triggers restarts
- `START_SCRIPT`: script name from package.json (defaults to "start")
- `ONCE_SCRIPT`: optional script to run only once when file is touched

**Note:** This file contains the webhook secret in plaintext. It's gitignored but users should be warned not to reuse important passwords.

## Code Style

- TypeScript with Node 24's native type stripping (no compilation step)
- ESLint 9 with flat config (`eslint.config.ts`)
- Prettier for code formatting
- Prefer `type` over `interface` for type definitions
- Emoji prefixes for different log types (✨ info, ❗ errors, 🔊 output, etc.)
- Async/await preferred over raw promises
- All source files use `.ts` extension
