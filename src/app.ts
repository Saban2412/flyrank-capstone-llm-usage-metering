import express from "express";
import { Request, Response } from "express";
import { pool } from "./db/pool.js";
import routerBilling from "./routes/billing.routes.js";
import { BillingController } from "./controllers/billing.controller.js";

const app = express();
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ message: "Health connected successfuly!" });
});
app.get("/health/pool", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
    });
  }
});
app.use("/api", routerBilling);
export default app;
