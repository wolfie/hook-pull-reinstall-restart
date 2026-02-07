import crypto from 'crypto';

const createIsValidBody =
  (secret: string) => (headerSignature: string, body: string) => {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
    const untrusted = Buffer.from(headerSignature, 'ascii');
    return crypto.timingSafeEqual(trusted, untrusted);
  };

export default createIsValidBody;
