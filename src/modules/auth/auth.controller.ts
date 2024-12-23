import { BaseController } from "../../abstractions/base.controller";
import { KGBResponse } from "../../util/global";
import { KGBAuth } from "../../configs/passport";
import { JwtPayload, sign, verify } from "jsonwebtoken";
import WelcomeEmail from "../../email/templates/welcome";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import sendEmail from "../../email/process";
import { render } from "@react-email/render";
import axios from "axios";
import HttpException from "../../exceptions/http-exception";
import { KGBRequest, User } from "../../util/global";
import { Platform, RoleEnum } from "@prisma/client";
import { downloadImage } from "../../configs/multer";
import { getUniqueSuffix, normalizeEmail } from "../../util";
import { updateSearchAccent } from "../../prisma/prisma.service";
import { handleCloudSaveConversation } from "../chat/chat.service";

export default class AuthController extends BaseController {
  public path = "/api/v1/auth";

  private client: OAuth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    "postmessage",
  );

  public initializeRoutes() {
    this.router.get("/", KGBAuth("google", { scope: ["profile", "email"] }));
    this.router.get("/redirect", KGBAuth("google"), this.redirect);
    this.router.post("/login", this.login);
    this.router.post("/refresh", this.refresh);
    this.router.post("/logout", KGBAuth("jwt"), this.logout);
    this.router.get("/gen-token", this.genToken);
  }

  genToken = async (req: KGBRequest, res: KGBResponse) => {
    if (process.env.JUST_TEST && Number(process.env.JUST_TEST) === 1) {
      const email = req.gp<string>("email", undefined, String);
      const user = await this.prisma.user.findFirst({
        where: { email },
        include: { roles: { include: { role: true } } },
      });
      if (!user) {
        throw new HttpException(404, "User not found");
      }
      const accessToken = this.generateAccessToken(
        {
          email: user.email,
        },
        true,
      );
      return res.status(200).data({ accessToken });
    }
  };

  upsertUser = async (
    email: string,
    picture: string,
    family_name: string,
    given_name: string,
  ) => {
    let user = await this.prisma.user.findFirst({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user && email) {
      const uniqueSuffix = await getUniqueSuffix(
        "username",
        this.prisma.user,
        "user_",
      );
      const _ = await this.prisma.user.create({
        data: {
          username: uniqueSuffix,
          email,
          firstName: given_name,
          lastName: family_name,
          roles: {
            create: {
              role: {
                connect: {
                  name: RoleEnum.USER,
                },
              },
            },
          },
          platform: Platform.GOOGLE,
        },
      });
      await handleCloudSaveConversation(_.id);
      await updateSearchAccent("user", _.id);
      await this.prisma.cart.create({
        data: {
          userId: _.id,
        },
      });
      const avatar = picture;
      if (avatar) {
        const _avatar = await downloadImage(avatar, _.id);
        if (_avatar) {
          await this.prisma.user.update({
            where: { email },
            data: { avatarFileId: _avatar.id },
          });
        }
      }

      const emailHtml = render(
        WelcomeEmail({ userFirstName: given_name || "" }),
      );

      await sendEmail(emailHtml, email, "Your Adventure Begins with KGB Hub!");
    }

    user = await this.prisma.user.findFirst({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (user.syncWithGoogle) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: given_name,
          lastName: family_name,
        },
      });
      const avatar = picture;
      if (avatar) {
        const _avatar = await downloadImage(avatar, user.id);
        if (_avatar) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { avatarFileId: _avatar.id },
          });
        }
      }
    }
    if (!user.avatarFileId) {
      const avatar = picture;
      if (avatar) {
        const _avatar = await downloadImage(avatar, user.id);
        console.log("Avatar", _avatar);

        if (_avatar) {
          await this.prisma.user.update({
            where: { email },
            data: { avatarFileId: _avatar.id },
          });
        }
      }
    }

    delete user.platform;
    delete user.refreshToken;

    return user;
  };

  generateAccessToken = (user: { email: string }, neverExp = false) => {
    if (neverExp) {
      return sign({ user: { email: user.email } }, process.env.SECRET || "", {
        expiresIn: "100y",
      });
    }
    return sign({ user: { email: user.email } }, process.env.SECRET || "", {
      expiresIn: "7d",
    });
  };

  generateRefreshToken = (user: { email: string }) => {
    return sign(
      { user: { email: user.email } },
      process.env.REFRESH_SECRET || "",
      {
        expiresIn: "14d",
      },
    );
  };

  redirect = async (req: KGBRequest, res: KGBResponse) => {
    const accessToken = this.generateAccessToken(req.user);
    const refreshToken = this.generateRefreshToken(req.user);
    await this.prisma.user.update({
      where: {
        email: req.user.email,
      },
      data: {
        refreshToken,
      },
    });
    if (accessToken.includes("ERROR")) {
      return res
        .status(403)
        .data({ message: accessToken.replace("ERROR: ", "") });
    }
    return res.status(200).data({ accessToken, refreshToken });
  };

  login = async (req: KGBRequest, res: KGBResponse) => {
    let email, picture, family_name, given_name;

    if (req.body.accessToken && !req.body.token) {
      const { data } = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${req.body.accessToken}` },
        },
      );

      email = normalizeEmail(data.email);
      picture = data.picture;
      family_name = data.family_name;
      given_name = data.given_name;
    } else if (req.body.token && !req.body.accessToken) {
      const { token } = req.body;

      const ticket = await this.client.verifyIdToken({
        idToken: token,
      });

      const payload = ticket.getPayload() as TokenPayload;
      email = normalizeEmail(payload.email);
      picture = payload.picture;
      family_name = payload.family_name;
      given_name = payload.given_name;
    } else {
      throw new HttpException(400, "Missing accessToken or credentials");
    }

    const data = await this.upsertUser(email, picture, family_name, given_name);

    if (data && data.id && data?.email && data.roles) {
      const accessToken = this.generateAccessToken({
        email: data.email,
      });

      const refreshToken = this.generateRefreshToken({
        email: data.email,
      });

      await this.prisma.user.update({
        where: {
          email: data.email,
        },
        data: {
          refreshToken,
        },
      });
      if (accessToken.includes("ERROR")) {
        return res
          .status(403)
          .data({ message: accessToken.replace("ERROR: ", "") });
      }
      return res.status(200).data({
        accessToken,
        refreshToken,
        data,
      });
    }
  };

  refresh = async (req: KGBRequest, res: KGBResponse) => {
    const refreshToken = req.body.refreshToken;
    const payload = verify(
      refreshToken,
      process.env.REFRESH_SECRET || "",
    ) as JwtPayload;

    if (
      !payload ||
      !(await this.prisma.user.findFirst({ where: { refreshToken } }))
    ) {
      throw new HttpException(401, "Invalid refreshToken");
    }
    const reqUser = payload.user as User;
    const user = await this.prisma.user.findFirst({
      where: { email: reqUser.email },
      include: { roles: { include: { role: true } } },
    });

    const newRefreshToken = this.generateRefreshToken({
      email: user.email,
    });
    const accessToken = this.generateAccessToken({
      email: user.email,
    });

    await this.prisma.user.update({
      where: {
        email: reqUser.email,
      },
      data: {
        refreshToken: newRefreshToken,
      },
    });
    if (accessToken.includes("ERROR")) {
      return res
        .status(403)
        .data({ message: accessToken.replace("ERROR: ", "") });
    }
    res.data({ accessToken, newRefreshToken });
  };

  logout = async (req: KGBRequest, res: KGBResponse) => {
    await this.prisma.user.update({
      where: {
        email: req.user.email,
      },
      data: {
        refreshToken: null,
      },
    });

    res.status(200).data({ message: "Logged out" });
  };
}
