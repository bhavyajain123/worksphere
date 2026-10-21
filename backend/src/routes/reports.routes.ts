
import { Router } from "express";
import {
  getOverview,
  getProjectAnalytics,
  getEmployeeAnalytics,
  getProjectFinancials,
  exportProjectFinancialsCsv,
   saveReport,
     getSavedReports,
      getSavedReportById,
      deleteSavedReport,
      updateSavedReport,
} from "../controllers/reports.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.get("/overview", getOverview);

router.get("/projects/:projectId", getProjectAnalytics);

router.get(
  "/projects/:projectId/financials",
  getProjectFinancials
);

router.get(
  "/projects/:projectId/financials/export",
  exportProjectFinancialsCsv
);

router.get("/employees/:employeeId", getEmployeeAnalytics);

router.post("/saved", saveReport);

router.get("/saved", getSavedReports);
router.get("/saved/:reportId", getSavedReportById);
router.delete("/saved/:reportId", deleteSavedReport);
router.patch("/saved/:reportId", updateSavedReport);

export default router;
