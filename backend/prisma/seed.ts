import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 12);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      fullName: 'مدير النظام',
      role: Role.admin,
    },
  });

  // Slice 5 (MMP): مستخدم صيدلي تجريبي — راجع Decision 014
  await prisma.user.upsert({
    where: { username: 'pharmacist1' },
    update: {},
    create: {
      username: 'pharmacist1',
      passwordHash: adminPasswordHash,
      fullName: 'صيدلي تجريبي',
      role: Role.pharmacist,
    },
  });

  // Slice 6 (MMP): مستخدم فني مختبر/أشعة تجريبي — راجع Decision 016
  await prisma.user.upsert({
    where: { username: 'labtech1' },
    update: {},
    create: {
      username: 'labtech1',
      passwordHash: adminPasswordHash,
      fullName: 'فني مختبر تجريبي',
      role: Role.lab_tech,
    },
  });

  // Slice 7 (MMP): مستخدم موظف فوترة تجريبي — راجع Decision 018
  await prisma.user.upsert({
    where: { username: 'billing1' },
    update: {},
    create: {
      username: 'billing1',
      passwordHash: adminPasswordHash,
      fullName: 'موظف فوترة تجريبي',
      role: Role.billing_clerk,
    },
  });

  const departments = [
    { nameAr: 'الباطنية', nameEn: 'Internal Medicine', totalBeds: 5 },
    { nameAr: 'الجراحة', nameEn: 'Surgery', totalBeds: 5 },
    { nameAr: 'الطوارئ', nameEn: 'Emergency', totalBeds: 5 },
  ];

  for (const dept of departments) {
    const existing = await prisma.department.findFirst({ where: { nameEn: dept.nameEn } });
    const department = existing ?? (await prisma.department.create({ data: dept }));
    if (existing) continue; // تجنّب تكرار الأسرّة عند إعادة تشغيل seed

    for (let i = 1; i <= dept.totalBeds; i++) {
      await prisma.bed.create({
        data: {
          departmentId: department.id,
          bedNumber: `${dept.nameEn.slice(0, 2).toUpperCase()}-${i}`,
        },
      });
    }
  }

  // Slice 5 (MMP): مخزون دواء تجريبي أولي
  const medications = [
    { name: 'Paracetamol 500mg', unit: 'قرص', currentStock: 200, reorderThreshold: 30 },
    { name: 'Amoxicillin 250mg', unit: 'كبسولة', currentStock: 150, reorderThreshold: 20 },
    { name: 'Ibuprofen 400mg', unit: 'قرص', currentStock: 15, reorderThreshold: 20 }, // أقل من الحد عمداً لاختبار FR-6.5
  ];
  for (const med of medications) {
    const existing = await prisma.medication.findUnique({ where: { name: med.name } });
    if (!existing) await prisma.medication.create({ data: med });
  }

  console.log('✅ Seed data created: admin + pharmacist + lab_tech + billing_clerk users, 3 departments with beds, 3 medications.');
  console.log('⚠️  كلمة مرور المستخدمين التجريبيين المؤقتة: 123 — غيّرها فوراً في بيئة حقيقية.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
