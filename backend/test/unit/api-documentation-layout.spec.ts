import { SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { setupApiDocumentation, swaggerModelWrapCss } from '../../src/api-documentation';

describe('documentation-only model layout', () => {
  afterEach(() => jest.restoreAllMocks());

  it('passes scoped wrapping CSS to the existing Swagger setup', () => {
    const document = { openapi: '3.0.0', info: { title: 'test', version: '0' }, paths: {} };
    jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue(document);
    const setup = jest.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);
    const app = {} as INestApplication;
    expect(setupApiDocumentation(app)).toBe(document);
    expect(setup).toHaveBeenCalledWith('api/docs', app, document, { customCss: swaggerModelWrapCss });
  });

  it('keeps complete text, native focus and desktop rules rather than masking overflow', () => {
    expect(swaggerModelWrapCss).toMatch(/^\s*@media \(max-width: 600px\)/);
    expect(swaggerModelWrapCss).toContain('overflow-wrap: anywhere');
    expect(swaggerModelWrapCss).toContain('.swagger-ui .models table.model');
    expect(swaggerModelWrapCss).not.toMatch(/overflow\s*:|hidden|clip|ellipsis|font-size|outline\s*:|display\s*:\s*none/);
    expect(swaggerModelWrapCss).not.toContain('!important');
  });
});
