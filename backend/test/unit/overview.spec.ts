import { DepartmentsService } from '../../src/modules/departments/departments.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('aggregate operational overview', () => {
  const start = '2026-11-27T00:00:00+03:00', end = '2026-11-28T00:00:00+03:00';
  it.each([['bad', end], [start, start], [end, start], [start, '2026-11-30T00:00:00Z']])('rejects invalid interval %s %s', async (a,b) => {
    const transaction = jest.fn();
    await expect(new DepartmentsService({ $transaction: transaction } as unknown as PrismaService).overview(a,b)).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
  it('returns only aggregate fields from one repeatable-read snapshot, with exclusive end', async () => {
    const tx = { department: { findMany: jest.fn().mockResolvedValue([{ id:'d', nameAr:'قسم', nameEn:'Department', beds:[{status:'available'}, {status:'occupied'}, {status:'maintenance'}] }]) }, appointment:{count:jest.fn().mockResolvedValue(3)} };
    const transaction = jest.fn(async callback => callback(tx));
    const service = new DepartmentsService({$transaction: transaction} as unknown as PrismaService);
    expect(await service.overview(start,end)).toEqual({ start:new Date(start).toISOString(), end:new Date(end).toISOString(), appointmentCount:3, departments:[{id:'d',nameAr:'قسم',nameEn:'Department',total:3,available:1,occupied:1,maintenance:1}] });
    expect(tx.appointment.count).toHaveBeenCalledWith({where:{scheduledAt:{gte:new Date(start),lt:new Date(end)}}});
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {isolationLevel:'RepeatableRead'});
    expect(tx.department.findMany).toHaveBeenCalledWith({select:{id:true,nameAr:true,nameEn:true,beds:{select:{status:true}}},orderBy:{nameEn:'asc'}});
  });
});
