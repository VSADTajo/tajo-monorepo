import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "path";
import { setupSwagger } from "./config/swagger";
import { validateToken } from "./middlewares/auth.middleware";
import logRouter from "./routes/log.routes";
import forecastRouter from "./routes/forecast.routes";
import healthRouter from "./routes/health.routes";
import inputDataRouter from "./routes/input-data.routes";
import ioHistoryRouter from "./routes/io-history.routes";
import predictionsDataRouter from "./routes/predictions-data.routes";
import reportsRouter from "./routes/reports.routes";
import exportsRouter from "./routes/exports.routes";
import alertRouter from "./routes/alert.routes";


const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(morgan("dev"));

app.use(cors({
    origin: process.env.NODE_ENV === "development" ? true : process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "Cache-Control", "Pragma"],
    credentials: true,
}));

app.use("/files", express.static(path.join(__dirname, "../dist/files_results")));

setupSwagger(app);

app.use("/api/health", healthRouter);
app.use("/api/logs", validateToken, logRouter);
app.use("/api/forecasts", validateToken, forecastRouter);
app.use("/api/input-data", validateToken, inputDataRouter);
app.use("/api/io-history", validateToken, ioHistoryRouter);
app.use("/api/predictions-data", validateToken, predictionsDataRouter);
app.use("/api/reports", validateToken, reportsRouter);
app.use("/api/exports", validateToken, exportsRouter);
app.use("/api/alerts", validateToken, alertRouter);

export default app;
