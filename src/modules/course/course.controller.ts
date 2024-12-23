import { BaseController } from "../../abstractions/base.controller";
import {
  File,
  KGBResponse,
  limitDefault,
  offsetDefault,
  userSelector,
} from "../../util/global";
import { KGBAuth } from "../../configs/passport";
import NotFoundException from "../../exceptions/not-found";
import HttpException from "../../exceptions/http-exception";
import checkRoleMiddleware from "../../middlewares/checkRole.middleware";
import {
  RoleEnum,
  Currency,
  CourseCategory,
  CourseStatus,
  LessonStatus,
  ProductType,
  ConversationType,
  ChatMemberRole,
  OrderStatus,
} from "@prisma/client";
import { KGBRequest } from "../../util/global";
import stripe from "../../configs/stripe";
import BigNumber from "bignumber.js";
import { fileMiddleware } from "../../middlewares/file.middleware";
import {
  deleteCourse,
  deletePart,
  getCourse,
  getCourses,
  refreshPart,
} from "./course.service";
import { convert } from "html-to-text";
import { isString } from "lodash";
import { checkBadWord, generateRandomString } from "../../util";
import { updateSearchAccent } from "../../prisma/prisma.service";

export default class CourseController extends BaseController {
  public path = "/api/v1/courses";

  public initializeRoutes() {
    this.router.post(
      `/`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.ADMIN, RoleEnum.AUTHOR]),
      this.createCourse,
    );
    this.router.get(`/`, KGBAuth("jwt"), this.getCourses);
    this.router.get(`/:id`, KGBAuth("jwt"), this.getCourse);
    this.router.patch(
      `/:id`,
      KGBAuth("jwt"),
      fileMiddleware([{ name: "thumbnail", maxCount: 1 }]),
      this.updateCourse,
    );
    this.router.delete(`/:id`, KGBAuth("jwt"), this.deleteCourse);
    this.router.post(`/:id/parts`, KGBAuth("jwt"), this.createPart);
    this.router.get(`/:id/parts`, this.getParts);
    this.router.get(`/:id/parts/:partId`, KGBAuth("jwt"), this.getPart);
    this.router.patch(`/:id/parts/:partId`, KGBAuth("jwt"), this.updatePart);
    this.router.delete(`/:id/parts/:partId`, KGBAuth("jwt"), this.deletePart);
    this.router.patch(
      `/:id/actions/approve`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      this.approveCourse,
    );
  }

  createCourse = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const courseName = `Course ${generateRandomString()}`;
    const product = await stripe.products.create({
      name: courseName,
      description: courseName,
      metadata: {
        userId: reqUser.id,
      },
      active: true,
      default_price_data: {
        currency: Currency.USD,
        unit_amount_decimal: String(0 * 100),
      },
    });
    const newCourse = await this.prisma.course.create({
      data: {
        courseName,
        totalDuration: 0,
        totalLesson: 0,
        totalPart: 0,
        knowledgeGained: [],
        descriptionMD: "",
        thumbnailFileId: "0",
        category: CourseCategory.OTHER,
        isPublic: false,
        user: { connect: { id: req.user.id } },
      },
    });
    await updateSearchAccent("course", newCourse.id);
    await this.prisma.product.create({
      data: {
        productStripeId: product.id,
        type: ProductType.COURSE,
        price: BigNumber(newCourse.priceAmount).toNumber(),
        name: newCourse.courseName,
        currency: newCourse.currency,
        course: { connect: { id: newCourse.id } },
      },
    });
    const course = await getCourse(newCourse.id, reqUser.id);
    res.status(200).data(course);
    const conversation = await this.prisma.conversation.create({
      data: {
        avatarFileId: "0",
        roomId: `course-${course.id}`,
        course: { connect: { id: course.id } },
        conversationName: course.courseName,
        conversationType: ConversationType.COURSE_GROUP_CHAT,
      },
    });
    await this.prisma.chatMember.create({
      data: {
        userId: reqUser.id,
        chatMemberRole: ChatMemberRole.ADMIN,
        conversationId: conversation.id,
      },
    });
    await updateSearchAccent("conversation", conversation.id);
  };

  getCourses = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const search = req.gp<string>("search", null, checkBadWord);
    const orderBy = (req.query.orderBy as string) || "createdAt";
    const direction = (req.query.direction as "asc" | "desc") || "desc";
    const status = req.gp<CourseStatus>("status", null, CourseStatus);
    const { courses, total } = await getCourses(
      reqUser.id,
      limit,
      offset,
      !!reqUser.roles.find((role) => role.role.name === RoleEnum.ADMIN),
      orderBy,
      direction,
      search,
      status,
    );
    return res.status(200).data(courses, total);
  };

  getCourse = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const id = req.gp<string>("id", undefined, String);
    const course = await getCourse(
      id,
      reqUser.id,
      !!reqUser.roles.find((role) => role.role.name === RoleEnum.ADMIN),
    );
    if (!course) {
      throw new NotFoundException("course", id);
    }
    return res.status(200).data(course);
  };

  updateCourse = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const reqUser = req.user;
    const course = await this.prisma.course.findFirst({
      where: { id },
      include: { products: true },
    });
    if (!course) {
      throw new NotFoundException("course", id);
    }
    let thumbnail: File = null;
    const thumbnailFile = req.fileModelsWithFieldName?.thumbnail
      ? req.fileModelsWithFieldName?.thumbnail.length === 1
        ? (req.fileModelsWithFieldName?.thumbnail)[0]
        : null
      : null;
    if (thumbnailFile) {
      thumbnail = thumbnailFile;
    } else if (req.body.thumbnailFileId) {
      thumbnail = { id: req.body.thumbnailFileId } as File;
    } else {
      thumbnail = { id: course.thumbnailFileId } as File;
    }
    if (
      !(
        course?.userId === req.user.id ||
        req.user.roles.find((role) => role.role.name === RoleEnum.ADMIN)
      )
    ) {
      throw new HttpException(401, "Access denied");
    }
    const courseName = req.gp<string>(
      "courseName",
      course.courseName,
      checkBadWord,
    );
    const descriptionMD = req.gp<string>(
      "descriptionMD",
      course.descriptionMD,
      checkBadWord,
    );
    const category = req.gp<CourseCategory>(
      "category",
      course.category,
      CourseCategory,
    );
    const isPublic =
      req.gp<string>("isPublic", String(course.isPublic), String) === "true";
    const priceAmount = parseFloat(
      req.gp<string>("priceAmount", String(course.priceAmount), String),
    );
    let knowledgeGained = req.body.knowledgeGained || course.knowledgeGained;
    if (isString(knowledgeGained)) {
      knowledgeGained = JSON.parse(knowledgeGained as string) as string[];
    }
    if (
      !(courseName && knowledgeGained.length > 0 && descriptionMD && category)
    ) {
      return new HttpException(400, "missing required fields");
    }
    for (const k of knowledgeGained) {
      checkBadWord(k);
    }

    const parts = await this.prisma.part.findMany({
      where: { courseId: id },
      include: { lessons: true },
    });
    let lessonsLength = 0;
    for (const part of parts) {
      lessonsLength += part.lessons.length;
    }
    const c = await this.prisma.course.update({
      where: { id },
      data: {
        courseName,
        knowledgeGained,
        isPublic: isPublic || false,
        descriptionMD,
        category: category || CourseCategory.OTHER,
        totalPart: parts.length,
        thumbnailFileId: thumbnail.id,
        totalLesson: lessonsLength,
        // status: CourseStatus.PENDING,
        priceAmount: priceAmount || 0,
        currency: Currency.USD,
      },
    });
    await updateSearchAccent("course", id);
    await this.prisma.product.update({
      where: { id: course.products[0].id },
      data: {
        type: ProductType.COURSE,
        price: BigNumber(c.priceAmount).toNumber(),
        description: convert(c.descriptionMD),
        name: c.courseName,
        currency: c.currency,
      },
    });
    await stripe.products.update(course.products[0].productStripeId as string, {
      name: courseName,
      description: descriptionMD,
    });
    const newCourse = await getCourse(id, reqUser.id);
    res.status(200).data(newCourse);
    await this.prisma.conversation.updateMany({
      where: { courseId: id },
      data: {
        avatarFileId: newCourse.thumbnailFileId,
        conversationName: newCourse.courseName,
        conversationType: ConversationType.COURSE_GROUP_CHAT,
      },
    });
    this.prisma.conversation
      .findMany({
        where: { courseId: id },
      })
      .then(async (cvs) => {
        for (const cv of cvs) {
          await updateSearchAccent("conversation", cv.id);
        }
      });
  };

  deleteCourse = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const id = req.gp<string>("id", undefined, String);
    const course = await getCourse(
      id,
      reqUser.id,
      reqUser.roles.some((role) => role.role.name === RoleEnum.ADMIN),
    );
    if (!course) {
      throw new NotFoundException("course", id);
    }

    if (
      course.userId !== reqUser.id &&
      !reqUser.roles.some((role) => role.role.name === RoleEnum.ADMIN)
    ) {
      throw new HttpException(401, "Access denied");
    }

    const coursePaids = await this.prisma.coursesPaid.findMany({
      where: { courseId: course.id },
      include: {
        order: true,
      },
    });

    if (
      coursePaids.some(
        (paid) =>
          paid.isFree ||
          (paid.order && paid.order.status === OrderStatus.SUCCESS),
      ) &&
      course.userId === reqUser.id &&
      !reqUser.roles.some((role) => role.role.name === RoleEnum.ADMIN)
    ) {
      throw new HttpException(400, "Course has been paid");
    }

    await deleteCourse(id);
    return res.status(200).data(course);
  };

  createPart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const courseId = req.gp<string>("id", undefined, String);
    const partNumber = parseInt(req.body.partNumber);
    const partName = req.gp<string>("partName", undefined, checkBadWord);
    if (!partNumber || isNaN(partNumber) || !partName || !courseId) {
      throw new Error("Missing required fields");
    }
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException("course", courseId);
    }
    if (
      !(
        course.userId === reqUser.id ||
        reqUser.roles.find((_) => _.role.name === RoleEnum.ADMIN)
      )
    ) {
      throw new Error("Not authorized");
    }
    const _ = await this.prisma.part.findFirst({
      where: { courseId, partNumber: partNumber },
    });
    if (_) {
      throw new Error("Part number already exists");
    }
    const description = req.gp<string>(
      "description",
      `${partNumber}: ${partName}`,
      checkBadWord,
    );
    const part = await this.prisma.part.create({
      data: {
        partNumber,
        partName,
        courseId,
        description,
      },
    });
    await refreshPart(courseId);
    return res.status(200).data(part);
  };

  getParts = async (req: KGBRequest, res: KGBResponse) => {
    const courseId = req.gp<string>("id", undefined, String);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException("course", courseId);
    }
    const parts = await this.prisma.part.findMany({
      where: { courseId },
      orderBy: { partNumber: "asc" },
    });
    return res.status(200).data(parts);
  };

  getPart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const courseId = req.gp<string>("id", undefined, String);
    const partId = req.gp<string>("partId", undefined, String);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException("course", courseId);
    }
    if (
      !(
        course.userId === reqUser.id ||
        reqUser.roles.find((_) => _.role.name === RoleEnum.ADMIN)
      )
    ) {
      throw new Error("Not authorized");
    }
    const part = await this.prisma.part.findFirst({
      where: { courseId, id: partId },
      orderBy: { partNumber: "asc" },
    });
    if (!part) {
      throw new NotFoundException("part", partId);
    }
    return res.status(200).data(part);
  };

  updatePart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const courseId = req.gp<string>("id", undefined, String);
    const partId = req.gp<string>("partId", undefined, String);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException("course", courseId);
    }
    if (
      !(
        course.userId === reqUser.id ||
        reqUser.roles.find((_) => _.role.name === RoleEnum.ADMIN)
      )
    ) {
      throw new Error("Not authorized");
    }
    const part = await this.prisma.part.findFirst({
      where: { id: partId, courseId },
    });
    if (!part) {
      throw new NotFoundException("part", partId);
    }
    const partName = req.gp<string>("partName", part.partName, checkBadWord);
    let { partNumber } = req.body;
    partNumber = parseInt(partNumber || "-1");
    if (partNumber < 0) {
      throw new Error("Invalid part number");
    }
    await this.prisma.part.update({
      where: { id: partId },
      data: {
        partNumber,
        partName,
      },
    });
    await refreshPart(courseId);
    return res.status(200).data(part);
  };

  deletePart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const courseId = req.gp<string>("id", undefined, String);
    const partId = req.gp<string>("partId", undefined, String);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException("course", courseId);
    }
    if (
      !(
        course.userId === reqUser.id ||
        reqUser.roles.find((_) => _.role.name === RoleEnum.ADMIN)
      )
    ) {
      throw new Error("Not authorized");
    }
    const part = await this.prisma.part.findFirst({
      where: { id: partId, courseId },
    });
    if (!part) {
      throw new NotFoundException("part", partId);
    }
    await deletePart(partId);
    await refreshPart(courseId);
    return res.status(200).data(part);
  };

  approveCourse = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    let course = await this.prisma.course.findFirst({
      where: { id },
      include: {
        parts: {
          include: {
            lessons: {
              include: {
                user: userSelector,
              },
            },
          },
        },
      },
    });
    if (!course) {
      throw new NotFoundException("course", id);
    }
    for (const part of course.parts) {
      for (const lesson of part.lessons) {
        await this.prisma.lesson.update({
          where: { id: lesson.id },
          data: { status: LessonStatus.APPROVED },
        });
      }
    }
    await this.prisma.course.update({
      where: { id },
      data: { status: CourseStatus.APPROVED },
    });
    course = await this.prisma.course.findFirst({
      where: { id },
      include: {
        parts: {
          include: {
            lessons: {
              include: {
                user: userSelector,
              },
            },
          },
        },
      },
    });
    return res.status(200).data(course);
  };
}
