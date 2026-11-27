import { Injectable, NotFoundException, UnauthorizedException, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { demoMode, workspaceContext } from '../../prisma/workspace-context';

@Injectable()
export class DemoService implements OnModuleDestroy {
  private bootstrap?: PrismaClient;
  async onModuleDestroy() { await this.bootstrap?.$disconnect(); }
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async create() {
    if (!demoMode()) throw new NotFoundException();
    // Same restricted runtime connection, no migration/owner credential. Only
    // this fixed function is exposed on an otherwise unscoped bootstrap client.
    const id = randomUUID();
    if (!this.bootstrap) { const u=new URL(process.env.DATABASE_URL!);u.searchParams.set('connection_limit','2');this.bootstrap=new PrismaClient({datasources:{db:{url:u.toString()}}}); }
    try { await this.bootstrap.$executeRaw`SELECT hms_create_demo_workspace(${id})`; }
    catch (error: unknown) {
      const e = error as {code?:string;meta?:{code?:string;message?:string}};
      if(e.code==='P2010'&&e.meta?.code==='P0001'&&e.meta.message?.includes('Demo capacity reached')) throw new ServiceUnavailableException({error:{code:'DEMO_CAPACITY_REACHED',message:'Demo capacity reached. Try again later.',details:[]}});
      throw error;
    }
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
