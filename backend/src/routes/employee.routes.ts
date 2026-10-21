import { Router } from "express";

import { listEmployees,getEmployee,updateEmployee,updateEmployeeStatus } from "../controllers/employee.controller";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";

const router = Router();
router.use(authenticateToken);

router.get(
  "/",authorizeRoles("admin"), listEmployees

);

router.get(
  "/:id", authorizeRoles("admin"), getEmployee
 
);

router.patch(
  "/:id",authorizeRoles("admin"), updateEmployee

);

router.patch(
  "/:id/status", authorizeRoles("admin"),updateEmployeeStatus
 
);

export default router;