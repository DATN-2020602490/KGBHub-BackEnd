import { Prisma, PrismaClient } from "@prisma/client";
import { createSoftDeleteExtension } from "prisma-extension-soft-delete";
import { processRecords } from "./prisma.service";

const _ = new PrismaClient();

_.$use(async (params, next) => {
  const result = await next(params);
  return processRecords(result);
});

const prisma = _.$extends(
  createSoftDeleteExtension({
    models: Object.keys(Prisma.ModelName).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>),
    defaultConfig: {
      field: "deletedAt",
      createValue: (deleted) => {
        if (deleted) return new Date();
        return null;
      },
    },
  }),
);

export default prisma;
