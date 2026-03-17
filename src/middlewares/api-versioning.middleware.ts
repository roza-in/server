import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * Current API version — source of truth
 */
export const CURRENT_API_VERSION = env.API_VERSION || 'v1';

/**
 * Supported API versions and their deprecation status
 */
const VERSION_REGISTRY: Record<string, { deprecated: boolean; sunset?: string; successor?: string }> = {
  v1: { deprecated: false },
  // Future: v2: { deprecated: false },
  // When v1 is deprecated: v1: { deprecated: true, sunset: '2026-01-01', successor: 'v2' },
};

/**
 * API Versioning Middleware
 *
 * Adds standard deprecation headers when a client uses a deprecated API version:
 * - Deprecation: true
 * - Sunset: <date>       — when the version will be removed
 * - Link: <url>          — URL of the successor version docs
 * - X-API-Version: <ver> — confirms the version being served
 *
 * Also supports Accept-Version / X-Api-Version header for version negotiation
 * (currently informational; full routing will be added when v2 launches).
 */
export const apiVersioning = (req: Request, res: Response, next: NextFunction) => {
  // Detect requested version from URL or header
  const urlVersion = req.baseUrl.match(/\/api\/(v\d+)/)?.[1];
  const headerVersion = (req.headers['accept-version'] || req.headers['x-api-version']) as string | undefined;
  const resolvedVersion = urlVersion || headerVersion || CURRENT_API_VERSION;

  // Set response header confirming the version
  res.setHeader('X-API-Version', resolvedVersion);

  // Check deprecation status
  const versionInfo = VERSION_REGISTRY[resolvedVersion];
  if (versionInfo?.deprecated) {
    res.setHeader('Deprecation', 'true');
    if (versionInfo.sunset) {
      res.setHeader('Sunset', new Date(versionInfo.sunset).toUTCString());
    }
    if (versionInfo.successor) {
      const successorUrl = `${req.protocol}://${req.get('host')}/api/${versionInfo.successor}`;
      res.setHeader('Link', `<${successorUrl}>; rel="successor-version"`);
    }
  }

  next();
};
