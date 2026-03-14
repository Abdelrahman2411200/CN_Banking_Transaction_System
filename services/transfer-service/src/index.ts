import express, { type Request, type Response } from "express";
import type { ApiResponse } from "@cn-banking/shared-types";

const app = express();
const port = Number(process.env.TRANSFER_SERVICE_PORT ?? 3002);

const healthHandler = (_req: Request, res: Response<ApiResponse<{ status: string; service: string }>>) => {
  res.status(200).json({
    success: true,
    data: { status: "ok", service: "transfer-service" }
  });
};

app.get("/health", healthHandler);
app.get("/v1/health", healthHandler);

app.post("/v1/transfers", (_req: Request, res: Response<ApiResponse<never>>) => {
  res.status(501).json({
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Endpoint not implemented yet"
    }
  });
});

app.listen(port, () => {
  console.log(`transfer-service listening on ${port}`);
});
