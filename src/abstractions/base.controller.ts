import { Router, NextFunction } from "express";
import IO from "../socket/io";
import prisma from "../prisma";
import { ExtendPrisma, KGBRequest, KGBResponse } from "../util/global";
import { normalizeEmail } from "../util";

class CustomRouter {
  public router: Router;

  constructor() {
    this.router = Router();
  }

  private wrap(params: any[]) {
    for (let i = 0, l = params.length; i < l; i++) {
      if (
        typeof params[i] === "function" &&
        params[i].constructor.name === "AsyncFunction"
      ) {
        const asyncHandle = params[i];

        params[i] = (req: KGBRequest, res: KGBResponse, next: NextFunction) => {
          if (req.query.email) {
            req.query.email = normalizeEmail(req.query.email as string);
          }
          if (req.body.email) {
            req.body.email = normalizeEmail(req.body.email as string);
          }
          if (req.query.email) {
            req.query.email = normalizeEmail(req.query.email as string);
          }
          return asyncHandle(req, res, next).catch(next);
        };
      }
    }
  }

  public get(match: string, ...handles: any[]) {
    this.wrap(handles);
    this.router.get(match, ...handles);
  }

  public post(match: string, ...handles: any[]) {
    this.wrap(handles);
    this.router.post(match, ...handles);
  }

  public put(match: string, ...handles: any[]) {
    this.wrap(handles);
    this.router.put(match, ...handles);
  }

  public patch(match: string, ...handles: any[]) {
    this.wrap(handles);
    this.router.patch(match, ...handles);
  }

  public delete(match: string, ...handles: any[]) {
    this.wrap(handles);
    this.router.delete(match, ...handles);
  }
}

export abstract class BaseController {
  public router: CustomRouter;
  public prisma: ExtendPrisma;
  public io: IO;
  public path: string;

  constructor() {
    this.prisma = prisma;
    this.router = new CustomRouter();
  }

  public abstract initializeRoutes(): void;
}
