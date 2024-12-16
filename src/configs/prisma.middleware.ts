import { filterDeletedRecords } from "../util";
import prisma from "./prisma";

prisma.$use(async (params, next) => {
  if (params.action === "delete" || params.action === "deleteMany") {
    params.action = params.action === "delete" ? "update" : "updateMany";
    params.args = params.args || {};
    params.args.data = { ...(params.args.data || {}), deletedAt: new Date() };
    const result = await next(params);
    return filterDeletedRecords(result);
  }

  if (["findFirst", "findUnique", "findMany"].includes(params.action)) {
    params.args = params.args || {};
    params.args.where = { ...(params.args.where || {}), deletedAt: null };
    const result = await next(params);
    return filterDeletedRecords(result);
  }

  if (
    ["create", "createMany", "update", "updateMany"].includes(params.action)
  ) {
    params.args = params.args || {};
    if (params.args.data) {
      params.args.data.deletedAt = null;
    }
    const result = await next(params);
    return filterDeletedRecords(result);
  }

  const result = await next(params);
  return filterDeletedRecords(result);
});
