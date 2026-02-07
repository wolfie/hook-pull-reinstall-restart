import * as log from '../log.mjs';
import crypto from 'crypto';

/**
 * Creates a webhook event handler for GitHub push events
 *
 * @param {Object} config
 * @param {string} config.githubWebhookSecret - Webhook secret
 * @param {string} config.mainBranchName - The branch name that triggers restarts
 * @param {boolean} config.verbose - Whether to enable verbose logging
 * @param {() => void} config.onPush - Callback to execute when a valid push event is received
 * @returns {(headers: Record<string, string | undefined>, body: string) => void} Event handler function
 */
export default function createWebhookHandler({
  githubWebhookSecret,
  mainBranchName,
  verbose,
  onPush,
}) {
  /**
   * @param {string} headerSignature
   * @param {string} body
   */
  const isValidBody = (headerSignature, body) => {
    const signature = crypto
      .createHmac('sha256', githubWebhookSecret)
      .update(body)
      .digest('hex');
    const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
    const untrusted = Buffer.from(headerSignature, 'ascii');
    return crypto.timingSafeEqual(trusted, untrusted);
  };

  return (headers, body) => {
    if (verbose) log.info(`[WebHook] [${new Date().toISOString()}] ${body}`);

    const signature = headers['x-hub-signature-256'];
    if (!signature) {
      return log.error(
        `[WebHook] [${new Date().toISOString()}] Received payload without a secret`,
      );
    }
    if (!isValidBody(signature, body)) {
      return log.error(
        `[WebHook] [${new Date().toISOString()}] Received payload with incorrect secret`,
      );
    }
    if (headers['x-github-event'] !== 'push') {
      // unhandled event
      if (verbose) {
        if (headers['x-github-event'])
          log.info(
            `[WebHook] [${new Date().toISOString()}] unhandled event: ${headers['x-github-event']}`,
          );
        else
          log.info(
            `[WebHook] [${new Date().toISOString()}] no event in header`,
          );
      }
      return;
    }

    /** @type {import('./github-events.js').PushEvent} */
    const pushEvent = JSON.parse(body);
    if (pushEvent.ref === `refs/heads/${mainBranchName}`) {
      console.log(
        `🆕 [WebHook] [${new Date().toISOString()}] ` +
          `${pushEvent.commits.length} new commit(s) to ${pushEvent.repository.full_name}@${mainBranchName}`,
      );
      onPush();
    }
  };
}
