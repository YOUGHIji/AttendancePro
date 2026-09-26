import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { errorHandler } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/request-logger.middleware";

const app = express();

const allowedOrigin = process.env.WEB_ORIGIN;
app.use(cors({ origin: (origin, callback) => {
  if (!origin || !allowedOrigin || origin === allowedOrigin) return callback(null, true);
  return callback(new Error("Origin not allowed"));
} }));
app.use(helmet());
app.use(compression());
app.use(requestLogger);
app.use(express.json({ limit: "100kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please try again later." },
});
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/change-password", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));

app.get("/", (_req, res) => res.json({ status: "ok", name: "AttendancePro API" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", routes);

// Keep unknown API paths in the same safe JSON shape as all other failures.
// This prevents Express's default HTML error page from reaching the mobile app.
app.use((req, res) => {
  res.status(404).json({ message: "The requested resource was not found." });
});

app.use(errorHandler);

export default app;
