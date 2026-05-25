import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stocksRouter from "./stocks";
import distributionsRouter from "./distributions";
import approvalsRouter from "./approvals";
import dashboardRouter from "./dashboard";
import anomaliesRouter from "./anomalies";
import insightsRouter from "./insights";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stocksRouter);
router.use(distributionsRouter);
router.use(approvalsRouter);
router.use(dashboardRouter);
router.use(anomaliesRouter);
router.use(insightsRouter);
router.use(notificationsRouter);
router.use(adminRouter);

export default router;
