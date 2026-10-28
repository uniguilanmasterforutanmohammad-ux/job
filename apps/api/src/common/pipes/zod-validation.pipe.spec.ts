import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({
  name: z.string().min(2),
  age: z.coerce.number().int().positive(),
});

describe('ZodValidationPipe', () => {
  it('returns the parsed payload on valid input', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ name: 'Ali', age: '30' });
    expect(result).toEqual({ name: 'Ali', age: 30 });
  });

  it('coerces and strips unknown keys', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ name: 'Sara', age: 20, injected: 'x' });
    expect(result).toEqual({ name: 'Sara', age: 20 });
    expect('injected' in result).toBe(false);
  });

  it('throws BadRequestException with issue paths on invalid input', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: 'A', age: -1 });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: Array<{ path: string; message: string }>;
      };
      expect(response.message).toHaveLength(2);
      expect(response.message.map((issue) => issue.path)).toEqual(['name', 'age']);
    }
  });
});
