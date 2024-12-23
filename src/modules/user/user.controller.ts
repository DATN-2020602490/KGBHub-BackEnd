import { BaseController } from "../../abstractions/base.controller";
import {
  Course,
  KGBResponse,
  limitDefault,
  offsetDefault,
  userSelector,
} from "../../util/global";
import { KGBAuth } from "../../configs/passport";
import HttpException from "../../exceptions/http-exception";
import NotFoundException from "../../exceptions/not-found";
import {
  CourseCategory,
  CourseStatus,
  FormStatus,
  OrderStatus,
  RoleEnum,
} from "@prisma/client";
import { File, KGBRequest } from "../../util/global";
import { fileMiddleware } from "../../middlewares/file.middleware";
import { removeAccent, updateSearchAccent } from "../../prisma/prisma.service";
import { checkBadWord } from "../../util";
import QUOTES from "../../configs/quotes.json";

export default class UserController extends BaseController {
  public path = "/api/v1/users";

  public initializeRoutes() {
    this.router.get(`/random-quote`, this.getRandomQuote);
    this.router.get(`/new-user`, KGBAuth("jwt"), this.newUser);
    this.router.get(`/`, KGBAuth("jwt"), this.getUsers);
    this.router.post(`/`, KGBAuth("jwt"), this.addUser);
    this.router.patch(
      `/:id`,
      KGBAuth("jwt"),
      fileMiddleware([
        { name: "avatar", maxCount: 1 },
        { name: "cover", maxCount: 1 },
      ]),
      this.updateUser,
    );
    this.router.delete(`/:id`, KGBAuth("jwt"), this.deleteUser);
    this.router.get(`/:id`, this.getUserDetail);
    this.router.get(`/users/profile`, KGBAuth("jwt"), this.getProfile);
    this.router.post(
      `/author/verify`,
      KGBAuth("jwt"),
      fileMiddleware([
        { name: "frontIdCard", maxCount: 1 },
        { name: "backIdCard", maxCount: 1 },
        { name: "selfie", maxCount: 1 },
      ]),
      this.authorVerify,
    );
    this.router.get(`/actions/hearted`, KGBAuth("jwt"), this.getHearted);
    this.router.get(`/actions/bought`, KGBAuth("jwt"), this.getBought);
    this.router.get(`/actions/rated`, KGBAuth("jwt"), this.getRated);
    this.router.get(`/actions/progress`, KGBAuth("jwt"), this.getProgress);
    this.router.get(`/actions/forms`, KGBAuth("jwt"), this.getMyForms);
    this.router.patch(`/actions/forms`, KGBAuth("jwt"), this.updateMyForm);
    this.router.get(`/actions/author-search/:search`, this.searchAuthor);
    this.router.get(`/actions/user-search/:search`, this.searchUser);
  }

  getUsers = async (req: KGBRequest, res: KGBResponse) => {
    const userRoles = req.user.roles;
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const query = {
      skip: offset,
      take: limit,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    };
    for (const userRole of userRoles) {
      if (userRole.role.name === RoleEnum.ADMIN) {
        const total = await this.prisma.user.count();
        const users = await this.prisma.user.findMany(query);
        return res.status(200).data(users, total);
      }
    }
    throw new HttpException(401, "Unauthorized");
  };

  addUser = async (req: KGBRequest, res: KGBResponse) => {
    return res.data({});
  };

  updateUser = async (req: KGBRequest, res: KGBResponse) => {
    const userRoles = req.user.roles;
    const id = req.gp<string>("id", undefined, String);
    const { phone, gender, birthday, syncWithGoogle } = req.body;
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) {
      throw new NotFoundException("user", id);
    }
    const username = req.gp<string>("username", user.username, checkBadWord);
    const firstName = req.gp<string>("firstName", user.firstName, checkBadWord);
    const lastName = req.gp<string>("lastName", user.lastName, checkBadWord);
    if (
      !(
        userRoles.find((userRole) => userRole.role.name === RoleEnum.ADMIN) ||
        user?.email === req.user.email
      )
    ) {
      throw new HttpException(401, "Unauthorized");
    }
    if (username) {
      const usernameExist = await this.prisma.user.findFirst({
        where: { username, id: { not: id } },
      });
      if (usernameExist) {
        throw new HttpException(400, "Username already exists");
      }
    }
    const data: any = {
      username: username || user.username,
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phone: phone || user.phone,
      gender: gender || user.phone,
      birthday: birthday || user.birthday,
      syncWithGoogle: syncWithGoogle === "true" || false,
    };
    const avatar = req.fileModelsWithFieldName?.avatar;
    const cover = req.fileModelsWithFieldName?.cover;
    if (avatar && avatar.length === 1) {
      data.avatarFileId = avatar[0].id;
    } else if (req.body.avatarFileId) {
      data.avatarFileId = req.body.avatarFileId;
    } else {
      data.avatarFileId = user.avatarFileId;
    }
    if (cover && cover.length === 1) {
      data.coverFileId = cover[0].id;
    } else if (req.body.coverFileId) {
      data.coverFileId = req.body.coverFileId;
    } else {
      data.coverFileId = user.coverFileId;
    }

    const updateUser = await this.prisma.user.update({
      where: { id: id },
      data,
    });
    await updateSearchAccent("user", id);
    return res.status(200).data(updateUser);
  };

  deleteUser = async (req: KGBRequest, res: KGBResponse) => {
    const userRoles = req.user.roles;
    const id = req.gp<string>("id", undefined, String);
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) {
      throw new NotFoundException("user", id);
    }
    if (
      req.user.id === id ||
      userRoles.find((userRole) => {
        if (userRole.role.name === RoleEnum.ADMIN) {
          return true;
        }
      })
    ) {
      await this.prisma.user.delete({
        where: { id: id },
      });
    }
    return res.status(200).data(user);
  };

  getUserDetail = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: { roles: { include: { role: { select: { name: true } } } } },
    });
    if (!user) {
      throw new NotFoundException("user", id);
    }
    delete user.refreshToken;
    return res.status(200).data(user);
  };
  getProfile = async (req: KGBRequest, res: KGBResponse) => {
    const user = await this.prisma.user.findFirst({
      where: { id: req.user.id },
      include: {
        roles: {
          include: {
            role: true,
            user: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException("user", req.user.id);
    }
    delete user.platform;
    delete user.refreshToken;
    delete user.firstTime;
    delete user.roles;
    res.status(200).data(user);
  };

  newUser = async (req: KGBRequest, res: KGBResponse) => {
    const user = req.user;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isNewUser: false },
    });
    const newUser = await this.prisma.user.findFirst({
      where: { id: user.id },
    });
    return res.status(200).data(newUser);
  };

  authorVerify = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    let frontIdCard: File = null;
    const frontIdCardFile = req.fileModelsWithFieldName?.frontIdCard
      ? req.fileModelsWithFieldName?.frontIdCard.length === 1
        ? req.fileModelsWithFieldName?.frontIdCard[0]
        : null
      : null;
    let backIdCard: File = null;
    const backIdCardFile = req.fileModelsWithFieldName?.backIdCard
      ? req.fileModelsWithFieldName?.backIdCard.length === 1
        ? req.fileModelsWithFieldName?.backIdCard[0]
        : null
      : null;
    let selfie: File = null;
    const selfieFile = req.fileModelsWithFieldName?.selfie
      ? req.fileModelsWithFieldName?.selfie.length === 1
        ? req.fileModelsWithFieldName?.selfie[0]
        : null
      : null;
    if (frontIdCardFile) {
      frontIdCard = frontIdCardFile;
    } else if (req.body.frontIdCardFileId) {
      frontIdCard = { id: req.body.frontIdCardFileId } as File;
    } else {
      throw new HttpException(400, "Please provide front ID card");
    }
    if (backIdCardFile) {
      backIdCard = backIdCardFile;
    } else if (req.body.backIdCardFileId) {
      backIdCard = { id: req.body.backIdCardFileId } as File;
    } else {
      throw new HttpException(400, "Please provide back ID card");
    }
    if (selfieFile) {
      selfie = selfieFile;
    } else if (req.body.selfieFileId) {
      selfie = { id: req.body.selfieFileId } as File;
    } else {
      throw new HttpException(400, "Please provide selfie");
    }
    const { linkCV } = req.body;
    const real_firstName = req.gp<string>(
      "real_firstName",
      undefined,
      checkBadWord,
    );
    const real_lastName = req.gp<string>(
      "real_lastName",
      undefined,
      checkBadWord,
    );
    const category = req.body.category as CourseCategory;
    if (!real_firstName || !real_lastName) {
      throw new HttpException(400, "Please provide your real name");
    }
    if (
      await this.prisma.submitForm.findFirst({
        where: { userId: reqUser.id },
      })
    ) {
      throw new HttpException(
        400,
        "You have already submitted your information",
      );
    }
    const submitForm = await this.prisma.submitForm.create({
      data: {
        user: { connect: { id: reqUser.id } },
        real_firstName,
        real_lastName,
        frontIdCardFileId: frontIdCard.id,
        backIdCardFileId: backIdCard.id,
        selfieFileId: selfie.id,
        linkCV,
        category,
      },
    });
    return res.status(200).data(submitForm);
  };
  getHearted = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const lessonHearted = await this.prisma.heart.findMany({
      where: {
        userId: reqUser.id,
        lessonId: { not: null },
      },
      include: {
        lesson: true,
      },
    });
    const courseHearted = await this.prisma.heart.findMany({
      where: { userId: reqUser.id, courseId: { not: null } },
      include: { course: true },
    });
    return res.status(200).data({ lessonHearted, courseHearted });
  };

  getBought = async (req: KGBRequest, res: KGBResponse) => {
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const orderBy = (req.query.orderBy as string) || "createdAt";
    const direction = (req.query.direction as "asc" | "desc") || "desc";
    const courses = (await this.prisma.course.findMany({
      where: {
        coursesPaid: {
          some: { userId: req.user.id, order: { status: OrderStatus.SUCCESS } },
        },
        isPublic: true,
        status: CourseStatus.APPROVED,
      },
      take: limit,
      skip: offset,
      orderBy: [
        {
          [orderBy]: direction,
        },
      ],
      include: {
        user: userSelector,
        coursesPaid: {
          where: { order: { status: OrderStatus.SUCCESS } },
          include: {
            order: { include: { vouchers: true } },
            user: userSelector,
          },
        },
        parts: {
          include: {
            lessons: true,
          },
        },
      },
    })) as Course[];
    const total = await this.prisma.course.count({
      where: {
        coursesPaid: {
          some: { userId: req.user.id, order: { status: OrderStatus.SUCCESS } },
        },
        isPublic: true,
        status: CourseStatus.APPROVED,
      },
    });

    for (const course of courses) {
      const totalBought = course.coursesPaid.filter(
        (cp) => cp.order.status === OrderStatus.SUCCESS,
      ).length;
      course["totalBought"] = totalBought;
      if (req.user) {
        const [isHearted, isBought, lessonDones, rating] = await Promise.all([
          this.prisma.heart.findFirst({
            where: {
              userId: req.user.id,
              courseId: course.id,
            },
          }),
          this.prisma.coursesPaid.findFirst({
            where: {
              userId: req.user.id,
              courseId: course.id,
              OR: [
                { isFree: true },
                { order: { status: OrderStatus.SUCCESS } },
              ],
            },
          }),
          this.prisma.lessonDone.findMany({
            where: {
              userId: req.user.id,
              lesson: {
                part: {
                  courseId: course.id,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          }),
          this.prisma.rating.findFirst({
            where: {
              courseId: course.id,
              userId: req.user.id,
            },
          }),
        ]);
        course["isHearted"] = !!isHearted;
        course["isBought"] = !!isBought;
        course["currentLessonId"] = lessonDones[0]?.lessonId;
        course["process"] = lessonDones.length
          ? Math.floor((lessonDones.length / course.totalLesson) * 100)
          : 0;
        course["myRating"] = rating;
      }
    }
    return res.status(200).data(courses, total);
  };
  getRated = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const courseId = req.gp<string>("courseId", null, String);
    if (courseId) {
      const rated = await this.prisma.rating.findFirst({
        where: { userId: reqUser.id, courseId },
        include: {
          course: true,
        },
      });
      return res.status(200).data(rated);
    }
    const rated = await this.prisma.rating.findMany({
      where: { userId: reqUser.id },
      take: limit,
      skip: offset,
      include: {
        course: true,
      },
    });
    const total = await this.prisma.rating.count({
      where: { userId: reqUser.id },
    });
    return res.status(200).data(rated, total);
  };
  getProgress = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const lessons = await this.prisma.lessonDone.findMany({
      where: { userId: reqUser.id },
      include: { lesson: { include: { part: true } } },
    });
    const _ = [] as { courseId: string; lessons: any[] }[];
    const __ = [] as string[];
    for (const lesson of lessons) {
      if (!__.includes(lesson.lesson.part.courseId)) {
        __.push(lesson.lesson.part.courseId);
      }
    }
    for (const id of __) {
      _.push({
        courseId: id,
        lessons: lessons.filter((lesson) => lesson.lesson.part.courseId === id),
      });
    }
    return res.status(200).data(_);
  };
  getMyForms = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const forms = await this.prisma.submitForm.findMany({
      where: { userId: reqUser.id },
    });
    return res.status(200).data(forms);
  };
  updateMyForm = async (req: KGBRequest, res: KGBResponse) => {
    const myForm = await this.prisma.submitForm.findFirst({
      where: { userId: req.user.id },
    });
    if (!myForm) {
      throw new NotFoundException("form", req.user.id);
    }
    const now = new Date();
    const is15Days =
      now.getTime() - myForm.updatedAt.getTime() > 15 * 24 * 60 * 60 * 1000;
    if (!(is15Days && myForm.status === FormStatus.REJECTED)) {
      throw new HttpException(400, "You can only update form every 15 days");
    }
    const { linkCV } = req.body;
    const real_firstName = req.gp<string>(
      "real_firstName",
      myForm.real_firstName,
      checkBadWord,
    );
    const real_lastName = req.gp<string>(
      "real_lastName",
      myForm.real_lastName,
      checkBadWord,
    );
    const category = req.body.category as CourseCategory;
    if (!real_firstName || !real_lastName) {
      throw new HttpException(400, "Please provide your real name");
    }
    if (!linkCV) {
      throw new HttpException(400, "Please provide your CV");
    }
    const submitForm = await this.prisma.submitForm.update({
      where: { id: myForm.id },
      data: {
        real_firstName,
        real_lastName,
        linkCV,
        category,
        status: FormStatus.PENDING,
      },
    });
    return res.status(200).data(submitForm);
  };

  searchAuthor = async (req: KGBRequest, res: KGBResponse) => {
    const search = req.gp<string>("search", null, checkBadWord);
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const where = {
      roles: { some: { role: { name: RoleEnum.AUTHOR } } },
    };
    if (search) {
      where["searchAccent"] = { contains: removeAccent(search) };
    }
    const users = await this.prisma.user.findMany({
      where,
      select: userSelector.select,
      take: limit,
      skip: offset,
    });
    const total = await this.prisma.user.count({
      where,
    });
    return res.status(200).data(users, total);
  };

  searchUser = async (req: KGBRequest, res: KGBResponse) => {
    const search = req.gp<string>("search", null, checkBadWord);
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const where = {};
    if (search) {
      where["searchAccent"] = { contains: removeAccent(search) };
    }
    const users = await this.prisma.user.findMany({
      where,
      select: userSelector.select,
      take: limit,
      skip: offset,
    });
    const total = await this.prisma.user.count({
      where,
    });
    return res.status(200).data(users, total);
  };

  getRandomQuote = async (_, res: KGBResponse) => {
    const quoteLength = QUOTES.length;
    let randomIndex = Math.floor(Math.random() * quoteLength);
    while (QUOTES[randomIndex].quote.length > 100) {
      randomIndex = Math.floor(Math.random() * quoteLength);
    }
    res.status(200).data(QUOTES[randomIndex]);
  };
}
