import { NextFunction } from "express";
import {
  KGBRequest,
  KGBResponse,
  limitDefault,
  offsetDefault,
  ResponseData,
} from "../util/global";
import { checkCondition, normalizeEmail } from "../util";
import { isArray } from "lodash";

export default (req: KGBRequest, res: KGBResponse, next: NextFunction) => {
  if (req.body.email) {
    req.body.email = normalizeEmail(req.body.email as string);
  }
  if (req.query.email) {
    req.query.email = normalizeEmail(req.query.email as string);
  }
  if (req.params.email) {
    req.params.email = normalizeEmail(req.params.email as string);
  }

  req.genNextUrl = (data: any[]) => {
    if (!isArray(data)) {
      return "";
    }
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number) + limit;
    const query = { ...req.query };

    if (data.length < limit) {
      return "";
    }

    query.offset = String(offset);

    return `${req.originalUrl.split("?")[0]}?${Object.keys(query)
      .map((k) => `${k}=${query[k]}`)
      .join("&")}`;
  };

  res.createResponse = (
    data: any,
    total?: number,
    option?: any,
  ): ResponseData => {
    if (option) {
      console.log("ROUTER: ", req.originalUrl);
      console.log(option);
    }
    if (isArray(data) && total) {
      const limit = req.gp<number>("limit", limitDefault, Number);
      const offset = req.gp<number>("offset", offsetDefault, Number);
      return {
        data,
        option,
        pagination: {
          page: offset / limit + 1,
          totalPages: Math.ceil(total / limit),
          total,
          next: req.genNextUrl(data),
        },
      };
    }
    return {
      data,
      option,
    };
  };

  req.gp = (key: string, defaultValue: any, validate: any) => {
    let value = [
      req.body[key],
      req.query[key],
      req.params[key],
      defaultValue,
    ].find((v) => v !== undefined);
    checkCondition(
      value !== undefined,
      `Missing param: ${key} code:missing_param`,
    );

    if (value === defaultValue) {
      return defaultValue;
    }

    if (typeof validate === "object") {
      validate = Object.values(validate);
    }

    if (typeof validate === "function") {
      const converted = validate(value);

      if (converted !== undefined) {
        value = converted;
      }
    } else if (Array.isArray(validate)) {
      checkCondition(
        validate.includes(value),
        `Invalid param ${key}, accept: ${validate.join(", ")}`,
      );
    } else if (validate instanceof RegExp) {
      checkCondition(
        validate.test(value),
        `Invalid param ${key}, accept: ${validate.toString()}`,
      );
    }

    return value;
  };

  res.data = (data: any, total?: number, option?: any) => {
    return res.json(res.createResponse(data, total, option));
  };

  res.error = (error: string | Error) => {
    checkCondition(false, error);
  };

  next();
};
