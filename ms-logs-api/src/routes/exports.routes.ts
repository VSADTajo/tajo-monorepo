import { Router } from "express";
import { ExportsController } from "../controllers/exports.controller";

const exportsRouter = Router();

exportsRouter.get("/prediction-types", ExportsController.listPredictionTypes);
exportsRouter.get("/files", ExportsController.listFiles);
exportsRouter.get("/files/:filename", ExportsController.downloadFile);
exportsRouter.get("/prediction-results/download", ExportsController.directDownload);
exportsRouter.post("/prediction-results", ExportsController.postExport);

export default exportsRouter;
