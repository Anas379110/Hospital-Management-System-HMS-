import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createApplication } from '../../src/app.factory';
import { setupApiDocumentation } from '../../src/api-documentation';

describe('Native API docs HTTP, mocked DB only', () => {
  let app: INestApplication;
  const oldJwt=process.env.JWT_SECRET, oldDb=process.env.DATABASE_URL, oldDemo=process.env.HMS_PUBLIC_DEMO; 
  beforeAll(async () => {
    process.env.JWT_SECRET = 'docs-http-test-only-not-real';
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/hms_docs_mock';
    process.env.HMS_PUBLIC_DEMO='false';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({}).compile();
    app = await createApplication({logger:false,appFactory:async()=>module.createNestApplication({logger:false})});
    setupApiDocumentation(app);
    await app.init();
  });
  afterAll(async () => { await app.close(); for(const [key,value]of Object.entries({JWT_SECRET:oldJwt,DATABASE_URL:oldDb,HMS_PUBLIC_DEMO:oldDemo}))if(value===undefined)delete process.env[key];else process.env[key]=value; });
  it('serves actual JSON with annotated request schema and protected demo role', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(res.body.components.schemas.CreatePatientDto.required).toEqual(['fullName', 'dateOfBirth', 'gender', 'phone']);
    expect(res.body.components.schemas.CreateInvoiceDto.properties.items.maxItems).toBe(50);
    expect(res.body.paths['/api/v1/demo/role'].post.security).toEqual([{ bearer: [] }]);
    expect(res.body.components.schemas.UpdatePatientDto.properties.dateOfBirth).toBeUndefined();
  });
  it('serves native Swagger UI and bundled initializer without DB access', async () => {
    await request(app.getHttpServer()).get('/api/docs/').expect(200).expect(/swagger-ui/);
    const res = await request(app.getHttpServer()).get('/api/docs/swagger-ui-init.js').expect(200);
    expect(res.text).toContain('CreatePatientDto');
    expect(res.text).toContain('insuranceCoveragePercent');
  });
});
