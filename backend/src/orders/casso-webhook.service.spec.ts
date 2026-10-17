import { createHmac } from 'node:crypto';
import {
  orderCodesFromDescription,
  verifyCassoSignature,
  type CassoWebhookBody,
} from './casso-webhook.service.js';

describe('Casso webhook verification', () => {
  const body: CassoWebhookBody = {
    error: 0,
    data: {
      id: 218897,
      reference: 'FT24364030863634',
      description: 'thanh toan AH12345',
      amount: 16775000,
    },
  };

  it('accepts a valid V2 HMAC and rejects tampering', () => {
    const secret = 'a-secure-casso-test-key';
    const timestamp = String(Date.now());
    // Keys are deliberately supplied out of order; production code must canonicalize them.
    const canonical = {
      data: {
        amount: 16775000,
        description: 'thanh toan AH12345',
        id: 218897,
        reference: 'FT24364030863634',
      },
      error: 0,
    };
    const signature = createHmac('sha512', secret)
      .update(`${timestamp}.${JSON.stringify(canonical)}`)
      .digest('hex');

    expect(verifyCassoSignature(`t=${timestamp},v1=${signature}`, body, secret)).toBe(true);
    expect(
      verifyCassoSignature(
        `t=${timestamp},v1=${signature}`,
        { ...body, data: { ...body.data, amount: 1 } } as CassoWebhookBody,
        secret,
      ),
    ).toBe(false);

    // Kiểm tra chống Replay Attack (quá 5 phút bị từ chối)
    const expiredTime = String(Date.now() - 400_000);
    const expiredSig = createHmac('sha512', secret)
      .update(`${expiredTime}.${JSON.stringify(canonical)}`)
      .digest('hex');
    expect(verifyCassoSignature(`t=${expiredTime},v1=${expiredSig}`, body, secret)).toBe(false);
  });

  it('extracts only complete AH order codes', () => {
    expect(orderCodesFromDescription('AIHUB AH10042 KH7 ah10042')).toEqual(['AH10042']);
    expect(orderCodesFromDescription('XAH10042 and AH12Z')).toEqual([]);
  });
});
