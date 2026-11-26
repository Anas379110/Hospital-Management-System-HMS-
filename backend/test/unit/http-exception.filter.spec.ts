import { ArgumentsHost, BadRequestException, ForbiddenException, HttpException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('HTTP exception response contract', () => {
  const filter = new AllExceptionsFilter();
  let response: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;

  beforeEach(() => {
    response = { status: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
    host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  });

  it('preserves standard validation status and field details', () => {
    filter.catch(new BadRequestException(['quantityDispensed must not be less than 1']), host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: {
      code: 'BAD_REQUEST', message: expect.any(String),
      details: ['quantityDispensed must not be less than 1'],
    } });
  });

  it('preserves the custom forbidden-role code without extra fields', () => {
    filter.catch(new ForbiddenException({ error: {
      code: 'FORBIDDEN_ROLE', message: 'Not allowed', details: [], secret: 'do-not-return',
    } }), host);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: {
      code: 'FORBIDDEN_ROLE', message: 'Not allowed', details: [],
    } });
  });

  it('handles a string-body 4xx exception', () => {
    filter.catch(new HttpException('Invalid request', 422), host);
    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith({ error: {
      code: 'UNPROCESSABLE_ENTITY', message: 'Invalid request', details: [],
    } });
  });

  it('normalizes malformed custom fields to safe response types', () => {
    filter.catch(new HttpException({ error: {
      code: 42, message: { secret: 'do-not-return' }, details: 'do-not-return',
    } }, 400), host);
    const payload = response.json.mock.calls[0][0];
    expect(response.status).toHaveBeenCalledWith(400);
    expect(typeof payload.error.code).toBe('string');
    expect(typeof payload.error.message).toBe('string');
    expect(payload.error.details).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain('do-not-return');
  });

  it('does not expose unknown exception text, stack or secret', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      filter.catch(new Error('database-password-test-secret'), host);
      expect(response.status).toHaveBeenCalledWith(500);
      const payload = response.json.mock.calls[0][0];
      expect(payload.error.code).toBe('INTERNAL_ERROR');
      expect(payload.error.details).toEqual([]);
      expect(JSON.stringify(payload)).not.toContain('database-password-test-secret');
      expect(payload).not.toHaveProperty('stack');
      expect(payload.error).not.toHaveProperty('stack');
    } finally { logger.mockRestore(); }
  });
  it('normalizes known parser failure without logging its credential-bearing body', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      filter.catch(Object.assign(new SyntaxError('private request text'), { type: 'entity.parse.failed', status: 400, body: 'private password' }), host);
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({ error: { code: 'BAD_REQUEST', message: 'Invalid request body', details: [] } });
      expect(logger).not.toHaveBeenCalled();
    } finally { logger.mockRestore(); }
  });
  it('sanitizes unknown error diagnostics instead of raw exception text', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      filter.catch(new Error('private password'), host);
      expect(JSON.stringify(logger.mock.calls)).not.toContain('private password');
    } finally { logger.mockRestore(); }
  });

});
