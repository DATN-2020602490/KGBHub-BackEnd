import { NextFunction } from "express";
import { KGBRequest, KGBResponse } from "../util/global";

type Res = {
  url?: string;
  method?: string;
  message?: string;
  code?: string;
};

const errorHandler = (
  error: any,
  req: KGBRequest,
  res: KGBResponse,
  next: NextFunction,
) => {
  const response: Res = {};

  response.message = "Unknown error";

  if (req) {
    response.url = req.originalUrl;
    response.method = req.method;
  }

  if (typeof error === "object") {
    Object.assign(response, error);
    response.message = error.message || error._message || "Unknown error";
  } else if (typeof error === "string") {
    response.message = error;
  }

  if (response.message?.includes("code:")) {
    const [message, code] = response.message?.split("code:");
    response.message = message.trim();
    response.code = code.trim();
  }

  if (res) {
    res
      .status(res.statusCode === 200 ? 400 : res.statusCode)
      .data({ error: response });
  }
  console.error(error);
};

process.on("unhandledRejection", errorHandler);

export default errorHandler;
