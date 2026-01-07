/**
 * ROZX Healthcare Platform - Entry Point
 * 
 * This is the main entry point for the application.
 * It bootstraps the server and handles initialization.
 */

import { logger } from './common/logger.js';

// Log startup
logger.info('='.repeat(50));
logger.info('ROZX Healthcare Platform - Starting...');
logger.info('='.repeat(50));

// Import and start server
import './server.js';
