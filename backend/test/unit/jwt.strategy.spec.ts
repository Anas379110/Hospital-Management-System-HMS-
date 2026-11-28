import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';

describe('Current-user session validation', () => {
  const payload = { sub: 'u', username: 'old', role: 'admin' };
  function setup(user: unknown) {
    const findUnique = jest.fn().mockResolvedValue(user);
    return { strategy: new JwtStrategy({ getOrThrow: () => 'synthetic-unit-test-only' } as unknown as ConfigService, { user: { findUnique } } as never), findUnique };
  }
  it.each([null, { id: 'u', isActive: false }])('rejects absent or disabled users', async user => {
    await expect(setup(user).strategy.validate(payload)).rejects.toMatchObject({ status: 401 });
  });
  it('uses current role and username instead of stale token claims', async () => {
    const { strategy, findUnique } = setup({ id: 'u', username: 'current', role: 'nurse', isActive: true });
    await expect(strategy.validate(payload)).resolves.toEqual({ userId: 'u', username: 'current', role: 'nurse' });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'u' }, select: { id: true, username: true, role: true, isActive: true } });
  });
});
