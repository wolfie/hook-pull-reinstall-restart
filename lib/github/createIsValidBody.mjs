import crypto from 'crypto';

/**
 * @param {string} secret The Webhook secret
 */
const createIsValidBody =
  (secret) =>
  /**
   * @param {string} headerSignature The `x-hub-signature-256` value
   * @param {string} body The webhook body
   */
  (headerSignature, body) => {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
    const untrusted = Buffer.from(headerSignature, 'ascii');
    return crypto.timingSafeEqual(trusted, untrusted);
  };

export default createIsValidBody;
