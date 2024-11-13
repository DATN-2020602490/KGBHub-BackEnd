import { NextFunction } from 'express';
import { KGBRequest, KGBResponse } from '../global';
import { normalizeEmail } from '../util/data.util';

const genNextUrl = (data: any, req: KGBRequest) => {
  if (!Array.isArray(data)) {
    return '';
  }

  const limit = req.gp<number>('limit', 12, Number);
  const offset = req.gp<number>('offset', 0, Number) + limit;
  const query = { ...req.query };

  if (data.length < limit) {
    return '';
  }

  query.offset = String(offset);

  return `${req.originalUrl.split('?')[0]}?${Object.keys(query)
    .map((k) => `${k}=${query[k]}`)
    .join('&')}`;
};

export default (req: KGBRequest, res: KGBResponse, next: NextFunction) => {
  req.gp = (key: string, defaultValue: any, validate: any) => {
    if (key === 'email') {
      if (req.body.email) {
        req.body.email = normalizeEmail(req.body.email as string);
      }
      if (req.query.email) {
        req.query.email = normalizeEmail(req.query.email as string);
      }
      if (req.params.email) {
        req.params.email = normalizeEmail(req.params.email as string);
      }
    }
    let value = [req.body[key], req.query[key], req.params[key], defaultValue].find((v) => v !== undefined);
    check(value !== undefined, `Missing param: ${key} code:missing_param`);

    if (value === defaultValue) {
      return defaultValue;
    }

    if (typeof validate === 'object') {
      validate = Object.values(validate);
    }

    if (typeof validate === 'function') {
      const converted = validate(value);

      if (converted !== undefined) {
        value = converted;
      }
    } else if (Array.isArray(validate)) {
      check(validate.includes(value), `Invalid param ${key}, accept: ${validate.join(', ')}`);
    } else if (validate instanceof RegExp) {
      check(validate.test(value), `Invalid param ${key}, accept: ${validate.toString()}`);
    }

    return value;
  };

  res.success = (data: any, option: any) => {
    const response: any = {};

    if (!option) {
      option = {};
    }

    if (option.meta) {
      response.meta = option.meta;
    }

    if (data !== undefined) {
      response.data = data;
    }

    if (req.gp<number>('limit', null)) {
      response.meta = response.meta || {};
      response.meta.next = genNextUrl(data, req);
    }

    return res.status(option.code || 200).json(response);
  };

  res.error = (error: string | Error) => {
    check(false, error);
  };

  next();
};
