import { BadRequestException, ForbiddenException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { DomainException } from '../exceptions/domain.exception.js';

function host() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status } as unknown as Response;
  const request = { method: 'GET', url: '/api/v1/test' } as unknown as Request;
  const ctx = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { ctx, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  // The filter intentionally logs 5xx errors; keep test output clean.
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('maps a DomainException to its status, message and code', () => {
    const { ctx, status, json } = host();
    filter.catch(DomainException.moduleDisabled(), ctx);
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: expect.stringContaining('ماژول'),
        details: { code: 'MODULE_DISABLED' },
      }),
    );
  });

  it('flattens array validation messages into details', () => {
    const { ctx, json } = host();
    filter.catch(new BadRequestException([{ path: 'name', message: 'too short' }]), ctx);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'داده‌های ورودی نامعتبر است',
        details: [{ path: 'name', message: 'too short' }],
      }),
    );
  });

  it('hides internal details for unexpected errors', () => {
    const { ctx, status, json } = host();
    filter.catch(new Error('boom: secret stack'), ctx);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'خطای داخلی سرور', details: undefined }),
    );
  });

  it('passes through a plain string HttpException message', () => {
    const { ctx, json } = host();
    filter.catch(new ForbiddenException('nope'), ctx);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'nope' }),
    );
  });
});
