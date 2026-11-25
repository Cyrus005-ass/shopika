import { describe, expect, it } from 'vitest';
const { validateSupportInput } = require('./support');

describe('support input validation', () => {
  it('trims and returns a valid subject and message', () => {
    expect(validateSupportInput({ subject: ' Aide ', message: ' Besoin d’aide ' })).toEqual({
      ok: true,
      value: { subject: 'Aide', message: 'Besoin d’aide' },
    });
  });

  it('rejects missing input and values over the supported limits', () => {
    expect(validateSupportInput(null).ok).toBe(false);
    expect(validateSupportInput({ subject: 'Sujet', message: ' ' }).ok).toBe(false);
    expect(validateSupportInput({ subject: 's'.repeat(121), message: 'Message' }).ok).toBe(false);
    expect(validateSupportInput({ subject: 'Sujet', message: 'm'.repeat(5001) }).ok).toBe(false);
  });
});
