# Hook-Pull-Reinstall-Restart

Sometimes you just want to run your app in your own home server and just keep it updated with as little effort as possible. I'd like to believe that _at least some_ apps _can_ run without Kubernetes and a convoluted CI-deployment pipeline.

This app runner

1. Pulls the latest changes
2. Installs all new dependencies
3. Runs the application
4. Listens to updates in your remote main branch and repeats

## Requirements

- Node 24 or later
- A cloned GitHub repository
- `package.json` file with a `start` script that runs your project
- A lockfile matching the `package.json`

## Get Started

First, set up an event source to receive GitHub webhooks. The easiest option is to go to https://smee.io/ and press the "Start a new channel" button. Make note of the URL provided.

Then create a new webhook for your GitHub project with that URL. (Repository > Settings > Webhooks > Add webhook). Make sure that

- The content type is `application/json`,
- A secret is set, and
- At least the `push` event is sent.

Finally, you can run the command `npx hook-pull-reinstall-restart`, and enter the event source URL when prompted:

```
> npx hook-pull-reinstall-restart
✔ Start script › start
✔ Script to run once (touch .hprrrc to trigger) › once
✔ Do you have an event source URL already? › Yes
✔ Event source URL … https://smee.io/aBcDeF1234567890
✔ Github webhook secret … myProjectSecret123
✔ Main branch name … main
✔ Save answers? … yes
✨ Saving answers to /home/wolfie/dev/my-project/.hprrrc
```

_Technically it doesn't matter if this command matches whichever package manager you use for your project. But preferences are preferences, so feel free to use `yarn dlx` or `pnpm dlx` instead of `npx`._

After this, the branch will be pulled, newest project dependencies will be installed, and the project started.

```
✨ [Event Source] Connecting to https://smee.io/aBcDeF1234567890
✅ [Event Source] Connected
✨ Running "git pull"
🔊  Already up to date.
✨ Running "pnpm install"
🔊  Lockfile is up to date, resolution step is skipped
🔊  Already up to date
🔊
🔊  Done in 422ms
✨ Running "echo "works""
✨ Child process running on PID 36658
🔊  works
```

If the webhook is set up correctly, the next time any updates happen in the main branch of your GitHub repository, the project will be killed, and everything will be restarted.

```
🆕 [WebHook] [2024-04-02T15:30:42.187Z] 1 new commit(s) to wolfie/my-project@master
✨ Killing child process
✨ Waiting 500ms
✨ Running "git pull"
🔊  Already up to date.
✨ Running "pnpm install"

...and so on...
```

## CLI Options

```
--interactive, -i
    Force interactive prompts on startup (default: use .hprrrc or environment variables)
--dev, -d
    Include devDependencies during package installation (default: production mode)
--verbose, -v
    Increase logging
```

## Environment Variables

The environment variables used are:

- `EVENT_SOURCE_URL`: The HTTP(S) address to the event source service that proxies GitHub webhook events (e.g., smee.io)
- `GITHUB_WEBHOOK_SECRET`: The [webhook's secret](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries#creating-a-secret-token) string
- `MAIN_BRANCH_NAME`: The name of the Git repository's main branch. This branch is what will trigger the cycle. Usually `master` or `main`.
- _(Optional)_ `START_SCRIPT`: The script in `package.json` to run when starting your app. If not given, defaults to "`start`".
- _(Optional)_ `ONCE_SCRIPT`: The script in `package.json` to run no more than once during the lifetime of the script. Triggered when `.hprrrc` is modified. If not given, no script is run.

The `ONCE_SCRIPT` feature can be used to e.g. launch a browser to view a website, but only once the first build is completed. It might be undesirable to always launch a new browser when the project gets relaunched. An easy way to trigger this is to execute `touch .hprrrc` in your project's build script.

These values are written into `.hprrrc` by the interactive prompt if asked to. If the file exists, the script will use those values automatically (without prompting). Use the `--interactive` flag to force prompts even when `.hprrrc` exists.

## Things of Note

The webhooks are proxied through a third party: [smee.io](https://smee.io/). I am not affiliated with them in any way, and I have no idea of what their data retention policies is. Best to assume that they will spy and mine your data as much as they can. That being said, [the data in GitHub's webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads) is not super expansive.

Also, if you choose to save the values when asked by the interactive prompt, your webhook secret will be saved in plaintext in a file called `.hprrrc`. So better not to reuse any known passwords.
