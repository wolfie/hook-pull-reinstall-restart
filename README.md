# Hook-Pull-Reinstall-Restart

Sometimes you just want to run your app in your own home server and just keep it updated with as little effort as possible. I'd like to believe that _at least some_ apps _can_ run without Kubernetes and a convoluted CI-deployment pipeline.

This app runner

1. Pulls the latest changes
2. Installs all new dependencies
3. Runs the application
4. Listens to updates in your remote main branch and repeats

## Project Requirements

- A `package.json` file with a `start` script that starts the project
- A GitHub repository with a webhook that
  - sends at least the `push` event
  - sends with `application/json` Content type
  - a non-empty secret

## To run...

Go to https://smee.io/ and press the "Start a new channel" button. Add the URL provided as a webhook for your repository in GitHub (Settings > Webhooks > Add webhook > Payload URL). Then, copy the alphanumeric part of the Smee.io URL. You'll provide that ID to the `hook-pull-reinstall-restart` interactive prompt.

In your server's terminal, clone your project repository from GitHub, and then run one of the following commands:

```bash
pnpm dlx hook-pull-reinstall-restart -p  # for pnpm
yarn dlx hook-pull-reinstall-restart -p  # for yarn
npx hook-pull-reinstall-restart -p       # for npm
```

Then answer the questions in the prompt. The "Smee.io channel id" is the alphanumeric part of the URL provided.

_Technically_ it doesn't matter if this command matches whichever package manager you use for your project. But preferences are preferences.

## CLI Options

```
--envs, -e
    Skip interactive prompts on startup and use environment variables instead
--prod, -p
    Omit devDependencies during package installation
```

## Things of Note

The webhooks are proxied through a third party: [smee.io](https://smee.io/). I am not affiliated with them in any way, and I have no idea of what their data retention policies is. Best to assume that they will spy and mine your data as much as they can. That being said, [the data in GitHub's webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads) is not super expansive.

Also, if you choose to save the values when asked by the interactive prompt, your webhook secret will be saved in plaintext in a file called `.hprrrc`. So better not to reuse any known passwords.
