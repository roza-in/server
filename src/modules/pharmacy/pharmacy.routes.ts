import { Router } from 'express';
import medicineRoutes from './medicines/medicine.routes.js';
import { orderRoutes } from './orders/order.routes.js';
// import returnRoutes from './returns/return.routes.js';
// import settlementRoutes from './settlements/settlement.routes.js';

const router = Router();

router.use('/medicines', medicineRoutes);
router.use('/orders', orderRoutes);
// router.use('/returns', returnRoutes);
// router.use('/settlements', settlementRoutes);

export default router;

