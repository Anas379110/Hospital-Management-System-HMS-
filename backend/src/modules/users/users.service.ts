import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { requireActor, writeEntityAudit } from '../../common/transaction-audit';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(search: string) {
    return this.prisma.user.findMany({
      where: { OR: [{ username: { contains: search, mode: 'insensitive' } }, { fullName: { contains: search, mode: 'insensitive' } }] },
      select: { id: true, username: true, fullName: true, role: true, isActive: true },
      orderBy: [{ username: 'asc' }, { id: 'asc' }],
      take: 50,
    });
  }

  async create(dto: CreateUserDto, actor: string) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.prisma.$transaction(async tx => {
    await requireActor(tx, actor, [Role.admin]);
    const existing = await tx.user.findFirst({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException({
        error: {
          code: 'USERNAME_TAKEN',
          message: 'اسم المستخدم مستخدَم بالفعل',
          details: [],
        },
      });
    }

    const user = await tx.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
      },
    });

    // لا نُعيد passwordHash أبداً في أي استجابة
    const { passwordHash: _omit, ...safeUser } = user;
    await writeEntityAudit(tx, actor, 'USER_CREATED', 'User', null, safeUser);
    return safeUser;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ error: { code: 'USERNAME_TAKEN', message: 'اسم المستخدم مستخدم بالفعل', details: [] } });
      throw error;
    });
  }

  async setActiveStatus(id: string, isActive: boolean, actor: string) {
    return this.prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(18472932)`;
    await requireActor(tx, actor, [Role.admin]);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${id} FOR UPDATE`);
    const before = await tx.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ error: { code: 'USER_NOT_FOUND', message: 'المستخدم غير موجود', details: [] } });
    if (!isActive && (id === actor || (before.role === Role.admin && before.isActive && await tx.user.count({ where: { role: Role.admin, isActive: true } }) <= 1))) throw new ConflictException({ error: { code: 'ADMIN_LOCKOUT_PREVENTED', message: 'لا يمكنك تعطيل حسابك أو آخر مدير نشط', details: [] } });
    const { passwordHash: _omit, ...safeUser } = await tx.user.update({
      where: { id },
      data: { isActive },
    });
    await writeEntityAudit(tx, actor, 'USER_STATUS_CHANGED', 'User', before, safeUser);
    return safeUser;
    });
  }
}
