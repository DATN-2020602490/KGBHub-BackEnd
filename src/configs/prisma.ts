/**
 * Use one instance of PrismaClient
 * for a long-running application
 */

import { PrismaClient } from "@prisma/client";

export default new PrismaClient();
