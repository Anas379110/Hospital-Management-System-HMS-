import { Prisma } from "@prisma/client";
import { LabService } from "../../src/modules/lab/lab.service";
import { PharmacyService } from "../../src/modules/pharmacy/pharmacy.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe.each(["lab", "pharmacy"] as const)(
  "typed pending %s selector",
  (kind) => {
    const setup = (ids: { id: string }[]) => {
      const rows = [{ id: "a", status: "pending" }];
      const findMany = jest.fn().mockResolvedValue(rows);
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue(ids),
        testOrder: { findMany },
        prescription: { findMany },
      };
      const transaction = jest.fn((fn) => fn(tx));
      const prisma = { $transaction: transaction } as unknown as PrismaService;
      const invoke = () =>
        kind === "lab"
          ? new LabService(prisma).pendingOrders()
          : new PharmacyService(prisma).pendingPrescriptions();
      return { rows, findMany, tx, transaction, invoke };
    };
    it("uses fixed typed SQL, same transaction and repeatable snapshot for unchanged hydration", async () => {
      const s = setup([{ id: "a" }]);
      expect(await s.invoke()).toEqual(s.rows);
      expect(s.transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
      const sql = s.tx.$queryRaw.mock.calls[0][0] as Prisma.Sql;
      expect(sql.values).toEqual([]);
      expect(sql.text).toContain(
        kind === "lab"
          ? "'pending'::\"TestOrderStatus\""
          : "'pending'::\"PrescriptionStatus\"",
      );
      expect(sql.text).not.toMatch(/LIMIT|OFFSET|DISABLE|leakproof/i);
      expect(s.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["a"] } },
          orderBy: kind === "lab" ? { orderedAt: "asc" } : { createdAt: "asc" },
        }),
      );
    });
    it("does not issue an unbounded hydration when RLS or an empty queue yields no IDs", async () => {
      const s = setup([]);
      expect(await s.invoke()).toEqual([]);
      expect(s.findMany).not.toHaveBeenCalled();
    });
  },
);
