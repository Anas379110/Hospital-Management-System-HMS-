// Separate current persisted session rows from mutation delegate fixtures.
// Tokens are still signed and verified by the real strategy and role guards.
export function withCurrentSessions<T extends object>(prisma: T, roles: Record<string, string>): T {
  return new Proxy(prisma, { get(target, key) {
    if (key !== 'user') return Reflect.get(target, key);
    const users = Reflect.get(target, key) ?? {};
    return new Proxy(users, { get(delegate, method) {
      if (method !== 'findUnique') return Reflect.get(delegate, method);
      return (args: { where: { id?: string }; select?: { username?: boolean } }) => {
        if (args.select?.username) {
          const id = args.where.id ?? '';
          return Promise.resolve(roles[id] ? { id, username: id, role: roles[id], isActive: true } : null);
        }
        return Reflect.get(delegate, 'findUnique')(args);
      };
    } });
  } });
}
