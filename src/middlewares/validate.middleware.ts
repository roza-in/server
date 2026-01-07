import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../common/errors.js';

// Type for parsed request data
interface ParsedRequest {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

/**
 * Validate middleware - validates request against Zod schema
 */
export const validate = (schema: ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed: ParsedRequest = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace request properties with parsed values
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query as typeof req.query;
      if (parsed.params !== undefined) req.params = parsed.params as typeof req.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zod 4 uses .issues instead of .errors
        const issues = (error as any).issues || (error as any).errors || [];
        const errors = issues.map((e: any) => ({
          field: e.path?.join('.') || '',
          message: e.message,
        }));
        next(new ValidationError(errors, 'Validation failed'));
      } else {
        next(error);
      }
    }
  };
};
