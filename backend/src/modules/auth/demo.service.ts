import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { demoMode, workspaceContext } from '../../prisma/workspace-context';

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async create() {
    if (!demoMode()) throw new NotFoundException();
    // Same restricted runtime connection, no migration/owner credential. Only
    // this fixed function is exposed on an otherwise unscoped bootstrap client.
    const bootstrap = new PrismaClient();
    const id = randomUUID();
    try { await bootstrap.$executeRaw`SELECT hms_create_demo_workspace(${id})`; }
    finally { await bootstrap.$disconnect(); }
    return workspaceContext.run(id, async () => await this.token(id, Role.receptionist));
  }
  async audit() {
    if (!demoMode()) throw new NotFoundException();
    // Only redacted business metadata, no patient demographics, tokens or IPs.
    return this.prisma.auditLog.findMany({take:100,orderBy:{createdAt:'desc'},select:{id:true,action:true,entityType:true,entityId:true,createdAt:true,user:{select:{username:true,role:true}}}});
  }
  async token(workspace: string, role: Role) {
    if (!demoMode()) throw new NotFoundException();
    const user = await this.prisma.user.findFirst({where:{role,isActive:true},select:{id:true,username:true,fullName:true,role:true}});
    if (!user) throw new UnauthorizedException();
    const accessToken = await this.jwt.signAsync({sub:user.id,workspace,kind:'fictional-demo'});
    return {accessToken,user,retentionHours:24};
  }
}
