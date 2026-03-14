import express, { type Request, type Response } from "express";
import type { ApiResponse } from "@cn-banking/shared-types";

const app = express();
const port = Number(process.env.ACCOUNT_SERVICE_PORT ?? 3001);

const healthHandler = (_req: Request, res: Response<ApiResponse<{ status: string; service: string }>>) => {
  res.status(200).json({
    success: true,
    data: { status: "ok", service: "account-service" }
  });
};

app.get("/health", healthHandler);
app.get("/v1/health", healthHandler);

app.get("/v1/accounts", (_req: Request, res: Response<ApiResponse<never>>) => {
  res.status(501).json({
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Endpoint not implemented yet"
    }
  });
});

app.listen(port, () => {
  console.log(`account-service listening on ${port}`);
});
