import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException({
        error: {
          code: 'USERNAME_TAKEN',
          message: 'اسم المستخدم مستخدَم بالفعل',
          details: [],
        },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
      },
    });

    // لا نُعيد passwordHash أبداً في أي استجابة
    const { passwordHash: _omit, ...safeUser } = user;
    return safeUser;
  }

  async setActiveStatus(id: string, isActive: boolean) {
    const { passwordHash: _omit, ...safeUser } = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
    return safeUser;
  }
}
