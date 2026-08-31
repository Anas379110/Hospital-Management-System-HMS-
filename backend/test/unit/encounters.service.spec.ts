import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EncountersService } from '../../src/modules/encounters/encounters.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('EncountersService', () => {
  let service: EncountersService;
  let prisma: {
    encounter: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    prescription: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      encounter: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      prescription: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [EncountersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(EncountersService);
  });

  const createDto = {
    patientId: 'patient-1',
    chiefComplaint: 'صداع مستمر',
    diagnosis: 'شقيقة (Migraine)',
  };

  it('ينشئ زيارة طبية مرتبطة بالطبيب الحالي', async () => {
    prisma.encounter.create.mockResolvedValue({ id: 'enc-1', doctorId: 'doc-1', ...createDto });

    const result = (await service.create(createDto, 'doc-1')) as { doctorId: string };

    expect(result.doctorId).toBe('doc-1');
    expect(prisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ doctorId: 'doc-1' }) }),
    );
  });

  it('findOne يرمي 404 لزيارة غير موجودة', async () => {
    prisma.encounter.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('findOne يرمي 404 لزيارة محذوفة منطقياً (Soft Deleted)', async () => {
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1', deletedAt: new Date() });
    await expect(service.findOne('enc-1')).rejects.toThrow(NotFoundException);
  });

  it('addPrescription يضيف وصفة لزيارة موجودة', async () => {
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1', deletedAt: null });
    prisma.prescription.create.mockResolvedValue({ id: 'rx-1', medicationName: 'Paracetamol' });

    const result = (await service.addPrescription('enc-1', {
      medicationName: 'Paracetamol',
      dosage: '500mg',
      duration: '5 أيام',
    })) as { medicationName: string };

    expect(result.medicationName).toBe('Paracetamol');
  });

  it('softDelete يرفض بـForbidden إن لم يكن الطبيب صاحب السجل ولا Admin', async () => {
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1', doctorId: 'doc-1', deletedAt: null });

    await expect(
      service.softDelete('enc-1', 'خطأ بالتشخيص', { userId: 'doc-2', role: 'doctor' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.encounter.update).not.toHaveBeenCalled();
  });

  it('softDelete ينجح لصاحب السجل نفسه', async () => {
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1', doctorId: 'doc-1', deletedAt: null });
    prisma.encounter.update.mockResolvedValue({ id: 'enc-1', deletedAt: new Date() });

    await service.softDelete('enc-1', 'خطأ بالتشخيص', { userId: 'doc-1', role: 'doctor' });

    expect(prisma.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'enc-1' },
        data: expect.objectContaining({ deleteReason: 'خطأ بالتشخيص' }),
      }),
    );
  });

  it('softDelete ينجح لـAdmin حتى لو لم يكن صاحب السجل', async () => {
    prisma.encounter.findUnique.mockResolvedValue({ id: 'enc-1', doctorId: 'doc-1', deletedAt: null });
    prisma.encounter.update.mockResolvedValue({ id: 'enc-1', deletedAt: new Date() });

    await service.softDelete('enc-1', 'مراجعة إدارية', { userId: 'admin-1', role: 'admin' });

    expect(prisma.encounter.update).toHaveBeenCalledTimes(1);
  });
});
