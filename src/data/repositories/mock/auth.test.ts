import { describe, expect, it } from 'vitest';
import { MockAuthRepository } from './index';

describe('MockAuthRepository.login', () => {
  const auth = new MockAuthRepository();
  it('logs in the member who owns the email', async () => {
    const s = await auth.login('ada.okonkwo@mail.com', 'x');
    expect(s.kind === 'member' && s.member.id).toBe('IWH-01250');
  });
  it('logs in by phone number', async () => {
    const s = await auth.login('08035554412', 'x');
    expect(s.kind === 'member' && s.member.id).toBe('IWH-00412');
  });
  it('returns pending for an unapproved registration', async () => expect((await auth.login('folake.o@mail.com', 'x')).kind).toBe('pending'));
  it('returns admin for staff', async () => expect((await auth.login('adaeze@iconicwealthhub.coop', 'x')).kind).toBe('admin'));
  it('rejects unknown identifiers', async () => await expect(auth.login('nobody@mail.com', 'x')).rejects.toThrow());
});
