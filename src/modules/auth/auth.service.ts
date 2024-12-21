import { JwtPayload, verify } from "jsonwebtoken";
import { User } from "../../util/global";
import prisma from "../../prisma";
import { normalizeEmail } from "../../util";
import { RoleEnum } from "@prisma/client";

export const decodeJWT = async (token: string): Promise<User> => {
  let { email } = (verify(token, process.env.SECRET as string) as JwtPayload)
    .user as User;
  if (!email) {
    throw new Error("Invalid token");
  }
  email = normalizeEmail(email);
  return (await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  })) as User;
};

export const checkRole = (user: User, roles: RoleEnum[]) => {
  return user.roles.some((_) => roles.includes(_.role.name));
};
