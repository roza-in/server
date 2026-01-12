import { Router } from 'express';
import {
  getDashboard,
  getRevenue,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  banUser,
  unbanUser,
} from '../modules/admin/admin.controller.js';
import { authenticate, adminOnly } from '../middlewares/auth.middleware.js';

const router = Router();

// Dashboard
router.get('/', authenticate, adminOnly, getDashboard);
router.get('/revenue', authenticate, adminOnly, getRevenue);
router.get('/users/growth', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { getUserGrowth } = await import('../modules/admin/admin.controller.js');
    return getUserGrowth(req, res, next);
  } catch (err) {
    next(err);
  }
});

// Users
router.get('/users', authenticate, adminOnly, listUsers);
router.get('/users/:id', authenticate, adminOnly, getUser);
router.patch('/users/:id', authenticate, adminOnly, updateUser);
router.delete('/users/:id', authenticate, adminOnly, deleteUser);
router.post('/users/:id/ban', authenticate, adminOnly, banUser);
router.post('/users/:id/unban', authenticate, adminOnly, unbanUser);

// Hospitals verification
router.get('/hospitals/pending', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { listPendingHospitals } = await import('../modules/admin/admin.controller.js');
    return listPendingHospitals(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.patch('/hospitals/:id/verify', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { verifyHospital } = await import('../modules/admin/admin.controller.js');
    return verifyHospital(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.post('/hospitals/:id/request-documents', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { requestDocuments } = await import('../modules/admin/admin.controller.js');
    return requestDocuments(req, res, next);
  } catch (err) {
    next(err);
  }
});

// Tickets
router.get('/tickets', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { listTickets } = await import('../modules/admin/admin.controller.js');
    return listTickets(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.get('/tickets/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { getTicket } = await import('../modules/admin/admin.controller.js');
    return getTicket(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.patch('/tickets/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { updateTicket } = await import('../modules/admin/admin.controller.js');
    return updateTicket(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.post('/tickets/:id/reply', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { replyTicket } = await import('../modules/admin/admin.controller.js');
    return replyTicket(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.post('/tickets/:id/close', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { closeTicket } = await import('../modules/admin/admin.controller.js');
    return closeTicket(req, res, next);
  } catch (err) {
    next(err);
  }
});

// Audit logs
router.get('/audit-logs', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { listAuditLogs } = await import('../modules/admin/admin.controller.js');
    return listAuditLogs(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.get('/audit-logs/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { getAuditLog } = await import('../modules/admin/admin.controller.js');
    return getAuditLog(req, res, next);
  } catch (err) {
    next(err);
  }
});

// Settings
router.get('/settings', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { getSettings } = await import('../modules/admin/admin.controller.js');
    return getSettings(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.get('/settings/:key', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { getSetting } = await import('../modules/admin/admin.controller.js');
    return getSetting(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.put('/settings/:key', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { updateSetting } = await import('../modules/admin/admin.controller.js');
    return updateSetting(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.post('/settings/:key/reset', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { resetSetting } = await import('../modules/admin/admin.controller.js');
    return resetSetting(req, res, next);
  } catch (err) {
    next(err);
  }
});

// Reports
router.post('/reports/:type', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { generateReport } = await import('../modules/admin/admin.controller.js');
    return generateReport(req, res, next);
  } catch (err) {
    next(err);
  }
});
router.get('/reports/scheduled', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { getScheduledReports } = await import('../modules/admin/admin.controller.js');
    return getScheduledReports(req, res, next);
  } catch (err) {
    next(err);
  }
});

export const adminRoutes = router;
