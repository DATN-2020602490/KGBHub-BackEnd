import { NextFunction } from "express";
import { RoleEnum } from "@prisma/client";
import { KGBRequest, KGBResponse } from "../util/global";

function checkRoleMiddleware(roles: RoleEnum[]) {
  return async (req: KGBRequest, res: KGBResponse, next: NextFunction) => {
    try {
      if (!roles || roles.length === 0) {
        return res.status(400).data({ msg: "Roles not provided" });
      }

      if (!req.user) {
        return res.status(401).data({ msg: "Access denied" });
      }
      const userRoles = req.user.roles;
      const authorized = userRoles.some((userRole) =>
        roles.some((role) => role === userRole.role.name),
      );

      if (!authorized) {
        return next(new Error("Access denied"));
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export default checkRoleMiddleware;
