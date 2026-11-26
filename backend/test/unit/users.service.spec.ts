import { UsersService } from '../../src/modules/users/users.service';

describe('User status transaction audit', () => {
  it('search selects only management identity, stable bounded results', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await new UsersService({ user: { findMany } } as never).search('fictional');
    expect(findMany).toHaveBeenCalledWith({ where: { OR: [{ username: { contains: 'fictional', mode: 'insensitive' } }, { fullName: { contains: 'fictional', mode: 'insensitive' } }] }, select: { id: true, username: true, fullName: true, role: true, isActive: true }, orderBy: [{ username: 'asc' }, { id: 'asc' }], take: 50 });
  });
  it('rejects missing target before write or audit', async () => {
    const tx = { user: { findUnique: jest.fn().mockResolvedValueOnce({ isActive: true, role: 'admin' }).mockResolvedValueOnce(null), update: jest.fn() }, auditLog: { create: jest.fn() }, $executeRaw: jest.fn(), $queryRaw: jest.fn() };
    const service = new UsersService({ $transaction: (callback: (arg: unknown) => unknown) => callback(tx) } as never);
    await expect(service.setActiveStatus('missing', false, 'admin')).rejects.toMatchObject({ response: { error: { code: 'USER_NOT_FOUND' } } });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('stores trusted active-state diff without credentials or names', async () => {
    const tx = { user: { findUnique: jest.fn().mockResolvedValueOnce({ isActive: true, role: 'admin' }).mockResolvedValueOnce({ id: 'u', isActive: true, passwordHash: 'private hash', fullName: 'private name' }), update: jest.fn().mockResolvedValue({ id: 'u', isActive: false, passwordHash: 'private hash', fullName: 'private name' }) }, auditLog: { create: jest.fn() }, $executeRaw: jest.fn(), $queryRaw: jest.fn() };
    const service = new UsersService({ $transaction: (callback: (arg: unknown) => unknown) => callback(tx) } as never);
    const result = await service.setActiveStatus('u', false, 'admin');
    expect(result).not.toHaveProperty('passwordHash');
    const record = tx.auditLog.create.mock.calls[0][0].data;
    expect(record.newValue.changedFields).toEqual(['isActive']);
    expect(JSON.stringify(record)).not.toContain('private');
  });
  it.each([{ target: 'actor', count: 2 }, { target: 'last-admin', count: 1 }])('blocks self or last-admin disable before write $target', async ({ target, count }) => {
    const tx = { user: { findUnique: jest.fn().mockResolvedValue({ id: target, role: 'admin', isActive: true }), count: jest.fn().mockResolvedValue(count), update: jest.fn() }, auditLog: { create: jest.fn() }, $executeRaw: jest.fn(), $queryRaw: jest.fn() };
    const service = new UsersService({ $transaction: (callback: (arg: unknown) => unknown) => callback(tx) } as never);
    await expect(service.setActiveStatus(target, false, 'actor')).rejects.toMatchObject({ response: { error: { code: 'ADMIN_LOCKOUT_PREVENTED' } } });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

});
