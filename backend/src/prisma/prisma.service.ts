import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { workspaceContext, demoMode } from './workspace-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    const transaction = this.$transaction.bind(this);
    const transactionScope = new AsyncLocalStorage<boolean>();
    const scope = async (tx: Prisma.TransactionClient) => {
      const id = workspaceContext.getStore();
      if (!id) throw new Error('Demo workspace context required');
      await transactionScope.run(true, () => tx.$executeRaw`SELECT set_config('hms.workspace_id', ${id}, true)`);
    };
    // All model and raw operations share a transaction-local scope. Never SET
    // session state on a pooled connection. Interactive domain transactions
    // retain the same scoped connection and audit atomicity.
    this.$use(async (params, next) => {
      if (!demoMode() || params.runInTransaction || transactionScope.getStore()) return next(params);
      return transaction(async (tx: Prisma.TransactionClient) => {
        await scope(tx);
        const client = tx as unknown as Record<string, unknown>;
        if (!params.model) {
          const args = Array.isArray(params.args) ? params.args : [params.args];
          let sql: { text: string; values: unknown[] };
          if (Array.isArray(args[0])) {
            const strings = args[0] as string[];
            sql = Prisma.sql(Object.assign([...strings], { raw: [...strings] }), ...args.slice(1));
          } else if (typeof args[0] === 'string') {
            sql = { text: args[0], values: args.slice(1) };
          } else {
            sql = args[0] as { text: string; values: unknown[] };
          }
          return transactionScope.run(true, () => params.action === 'queryRaw'
            ? tx.$queryRawUnsafe(sql.text, ...sql.values)
            : tx.$executeRawUnsafe(sql.text, ...sql.values));
        }
        const name = params.model.charAt(0).toLowerCase() + params.model.slice(1);
        const delegate = client[name] as Record<string, (args: unknown) => Promise<unknown>>;
        return transactionScope.run(true, () => delegate[params.action](params.args));
      });
    });
    const scopedTransaction = async (fn: unknown, options?: unknown) => {
      if (!demoMode()) return transaction(fn as never, options as never);
      if (typeof fn !== 'function') throw new Error('Demo requires an interactive scoped transaction');
      return transaction(async (tx: Prisma.TransactionClient) => { await scope(tx); return transactionScope.run(true, () => fn(tx)); }, options as never);
    };
    this.$transaction = scopedTransaction as typeof this.$transaction;
  }
  async onModuleInit() {
    await this.$connect();
    if (demoMode()) {
      // Query the session role, not application-configured role names. Fail before HTTP listen.
      const check = new PrismaClient();
      let rows: {unsafe:boolean}[];
      try { rows = await check.$queryRawUnsafe<{unsafe:boolean}[]>(`SELECT (
        (SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname=current_user)
        OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND pg_has_role(c.relowner,'USAGE'))
        OR has_schema_privilege(current_user,'public','CREATE')
        OR has_function_privilege(current_user,'hms_cleanup_expired_workspaces()','EXECUTE')
      ) AS unsafe`); } finally { await check.$disconnect(); }
      if (rows[0]?.unsafe !== false) throw new Error('Public demo requires restricted nonowner runtime grants');
    }
  }
  async onModuleDestroy() { await this.$disconnect(); }
}
