import { describe, expect, it } from 'vitest';
import { MockAuthRepository } from './index';

describe('MockAuthRepository.login', () => {
  const auth = new MockAuthRepository();
  it('logs in the member who owns the email', async () => {
    const { session } = await auth.login('ada.okonkwo@mail.com', 'x');
    expect(session.kind === 'member' && session.member.id).toBe('IWH-01250');
  });
  it('returns a user object carrying the member discriminant', async () => {
    const { user } = await auth.login('ada.okonkwo@mail.com', 'x');
    expect((user as { kind?: string }).kind).toBe('member');
  });
  it('logs in by phone number', async () => {
    const { session } = await auth.login('08035554412', 'x');
    expect(session.kind === 'member' && session.member.id).toBe('IWH-00412');
  });
  it('returns pending for an unapproved registration', async () => expect((await auth.login('folake.o@mail.com', 'x')).session.kind).toBe('pending'));
  it('returns admin for staff', async () => expect((await auth.login('adaeze@iconicwealthhub.coop', 'x')).session.kind).toBe('admin'));
  it('rejects unknown identifiers', async () => await expect(auth.login('nobody@mail.com', 'x')).rejects.toThrow());
});
