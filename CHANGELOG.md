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
