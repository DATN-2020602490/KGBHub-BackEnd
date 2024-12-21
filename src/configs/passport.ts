import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import AnonymousStrategy from "passport-anonymous";
import {
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth20";
import passport from "passport";
import { render } from "@react-email/render";
import sendEmail from "../email/process";
import WelcomeEmail from "../email/templates/welcome";
import prisma from "../prisma";
import { Platform, RoleEnum } from "@prisma/client";
import { downloadImage } from "./multer";
import { getUniqueSuffix, normalizeEmail } from "../util";
import { updateSearchAccent } from "../prisma/prisma.service";
import { handleCloudSaveConversation } from "../modules/chat/chat.service";

const User = prisma.user;

const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.CLIENT_ID || "",
    clientSecret: process.env.CLIENT_SECRET || "",
    callbackURL: process.env.CALLBACK_URL,
  },

  async (accessToken, refreshToken, profile, done: VerifyCallback) => {
    const email = profile._json.email;

    try {
      if (
        email &&
        !(await User.findFirst({ where: { email: normalizeEmail(email) } }))
      ) {
        const uniqueSuffix = await getUniqueSuffix("username", User, "user_");
        const _ = await User.create({
          data: {
            username: uniqueSuffix,
            email: normalizeEmail(email),
            firstName: profile._json.given_name,
            lastName: profile._json.family_name,
            platform: Platform.GOOGLE,
            roles: {
              create: {
                role: { connect: { name: RoleEnum.USER } },
              },
            },
          },
        });
        await handleCloudSaveConversation(_.id);
        await updateSearchAccent("user", _.id);
        await prisma.cart.create({
          data: {
            userId: _.id,
          },
        });
        const avatar = profile._json.picture;
        if (avatar) {
          const _avatar = await downloadImage(avatar, _.id);
          if (_avatar) {
            await prisma.user.update({
              where: { id: _.id },
              data: { avatarFileId: _avatar.id },
            });
          }
        }

        const emailHtml = render(
          WelcomeEmail({ userFirstName: profile._json.given_name || "" }),
        );

        await sendEmail(
          emailHtml,
          email,
          "Your Adventure Begins with KGB Hub!",
        );
      }

      const user = await User.findFirst({
        where: { email: normalizeEmail(email) },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });
      if (user.syncWithGoogle) {
        await User.update({
          where: { id: user.id },
          data: {
            firstName: profile._json.given_name,
            lastName: profile._json.family_name,
          },
        });
        const avatar = profile._json.picture;
        if (avatar) {
          const _avatar = await downloadImage(avatar, user.id);
          if (_avatar) {
            await prisma.user.update({
              where: { id: user.id },
              data: { avatarFileId: _avatar.id },
            });
          }
        }
      }
      if (!user.avatarFileId) {
        const avatar = profile._json.picture;
        if (avatar) {
          const _avatar = await downloadImage(avatar, user.id);
          if (_avatar) {
            await prisma.user.update({
              where: { id: user.id },
              data: { avatarFileId: _avatar.id },
            });
          }
        }
      }
      done(null, {
        id: user?.id,
        email: normalizeEmail(email),
        roles: user?.roles,
        username: user?.username,
      });
    } catch (error: any) {
      done(error);
    }
  },
);

const jwtStrategy = new JwtStrategy(
  {
    secretOrKey: process.env.SECRET,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  },
  (payload, done: VerifyCallback) => {
    // return done(null, payload.user)
    const reqUser = payload.user as { email: string };
    if (reqUser) {
      prisma.user
        .findFirst({
          where: { email: reqUser.email },
          include: { roles: { include: { role: true } } },
        })
        .then((user) => {
          if (!user) {
            return done(null, null);
          }
          payload.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            roles: user.roles,
          };
          return done(null, payload.user);
        });
    }
  },
);

passport.use("google", googleStrategy);
passport.use("jwt", jwtStrategy);
passport.use(new AnonymousStrategy());

export const KGBAuth = (
  strategy: string | string[] | passport.Strategy,
  options?: passport.AuthenticateOptions,
  callback?: passport.AuthenticateCallback | ((...args: any[]) => any),
) => {
  options = { session: false, ...options };
  return passport.authenticate(strategy, options, callback);
};
