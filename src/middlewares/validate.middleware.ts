import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../common/errors/index.js';

// Extend Request type to include validated data
declare module 'express-serve-static-core' {
  interface Request {
    validated?: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
  }
}

// Type for parsed request data
interface ParsedRequest {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

/**
 * Validate middleware - validates request against Zod schema
 * Stores validated data in req.validated and also updates req.body
 * Note: req.query and req.params are read-only in Express 4.x with certain configurations
 */
export const validate = (schema: ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed: ParsedRequest = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Store validated data in a custom property for safe access
      req.validated = {
        body: parsed.body,
        query: parsed.query,
        params: parsed.params,
      };

      // Update body (this is always writable)
      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }

      // For query and params, try to update but catch if read-only
      // Controllers can access validated data from req.validated if needed
      try {
        if (parsed.query !== undefined && typeof req.query === 'object') {
          // Clear and merge
          for (const key of Object.keys(req.query)) {
            delete (req.query as Record<string, unknown>)[key];
          }
          Object.assign(req.query, parsed.query);
        }
      } catch {
        // req.query is frozen/read-only, validated data is in req.validated.query
      }

      try {
        if (parsed.params !== undefined && typeof req.params === 'object') {
          // Clear and merge
          for (const key of Object.keys(req.params)) {
            delete (req.params as Record<string, unknown>)[key];
          }
          Object.assign(req.params, parsed.params);
        }
      } catch {
        // req.params is frozen/read-only, validated data is in req.validated.params
      }

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
