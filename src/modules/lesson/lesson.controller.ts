import { BaseController } from "../../abstractions/base.controller";
import { KGBResponse } from "../../global";
import NotFoundException from "../../exceptions/not-found";
import { KGBAuth } from "../../configs/passport";
import HttpException from "../../exceptions/http-exception";
import checkRoleMiddleware from "../../middlewares/checkRole.middleware";
import { RoleEnum, LessonType, LessonStatus } from "@prisma/client";
import { KGBRequest, File } from "../../global";
import { fileMiddleware } from "../../middlewares/file.middleware";
import { deleteLesson, getLesson, getLessons } from "./lesson.service";
import { refreshCourse } from "../course/course.service";

export default class LessonController extends BaseController {
  public path = "/api/v1/lessons";

  public initializeRoutes() {
    this.router.post(
      `/`,
      KGBAuth("jwt"),
      fileMiddleware([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
      ]),
      this.createLesson,
    );
    this.router.get(`/`, KGBAuth("jwt"), this.getLessons);
    this.router.get(`/:id`, KGBAuth("jwt"), this.getLesson);
    this.router.patch(
      `/:id`,
      KGBAuth("jwt"),
      fileMiddleware([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
      ]),
      this.updateLesson,
    );
    this.router.delete(`/:id`, KGBAuth("jwt"), this.deleteLesson);
    this.router.patch(
      `/:id/actions/approve`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      this.approveLesson,
    );
  }

  createLesson = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const lessonType = (req.body.lessonType as LessonType) || LessonType.VIDEO;
    if (lessonType === LessonType.VIDEO) {
      let video: File = null;
      const videoFile = req.fileModelsWithFieldName?.video
        ? req.fileModelsWithFieldName?.video.length === 1
          ? req.fileModelsWithFieldName?.video[0]
          : null
        : null;
      let thumbnail: File = null;
      const thumbnailFile = req.fileModelsWithFieldName?.thumbnail
        ? req.fileModelsWithFieldName?.thumbnail.length === 1
          ? req.fileModelsWithFieldName?.thumbnail[0]
          : null
        : null;
      if (videoFile) {
        video = videoFile;
      } else if (req.body.videoFileId) {
        video = { id: req.body.videoFileId } as File;
      } else {
        video = { id: null } as File;
      }

      if (thumbnailFile) {
        thumbnail = thumbnailFile;
      } else if (req.body.thumbnailFileId) {
        thumbnail = { id: req.body.thumbnailFileId } as File;
      } else {
        thumbnail = { id: null } as File;
      }
      const { lessonName, descriptionMD } = req.body;
      const lessonNumber = parseInt(req.body.lessonNumber || "0");
      const partId = req.gp<string>("partId", undefined, String);
      const courseId = req.gp<string>("courseId", undefined, String);
      const trialAllowed = req.body.trialAllowed === "true";
      if (
        !lessonName ||
        !lessonNumber ||
        !descriptionMD ||
        !partId ||
        !courseId
      ) {
        throw new HttpException(400, "Missing fields");
      }
      const lesson = await this.prisma.lesson.create({
        data: {
          lessonName,
          lessonNumber: Number(lessonNumber),
          part: { connect: { id: partId } },
          trialAllowed: trialAllowed || false,
          descriptionMD,
          status: LessonStatus.PENDING,
          user: { connect: { id: req.user.id } },
          videoFileId: (video as File).id,
          thumbnailFileId: (thumbnail as File).id,
        },
      });
      const newLesson = await getLesson(lesson.id, reqUser.id);
      res.status(200).json(newLesson);
      await this.prisma.course.update({
        where: { id: courseId },
        data: {
          totalDuration: { increment: (video as File).duration },
        },
      });
      await refreshCourse(courseId);
    } else if (lessonType === LessonType.TEXT) {
      const { lessonName, descriptionMD, title, content } = req.body;
      const lessonNumber = parseInt(req.body.lessonNumber || "0");
      const partId = req.gp<string>("partId", undefined, String);
      const courseId = req.gp<string>("courseId", undefined, String);
      const trialAllowed = req.body.trialAllowed === "true";
      if (
        !lessonName ||
        !lessonNumber ||
        !descriptionMD ||
        !partId ||
        !courseId
      ) {
        throw new HttpException(400, "Missing fields");
      }
      let thumbnail: File = null;
      const thumbnailFile = req.fileModelsWithFieldName?.thumbnail
        ? req.fileModelsWithFieldName?.thumbnail.length === 1
          ? req.fileModelsWithFieldName?.thumbnail[0]
          : null
        : null;
      if (thumbnailFile) {
        thumbnail = thumbnailFile;
      } else if (req.body.thumbnailFileId) {
        thumbnail = { id: req.body.thumbnailFileId } as File;
      } else {
        thumbnail = { id: null } as File;
      }
      const lesson = await this.prisma.lesson.create({
        data: {
          lessonName,
          lessonType: LessonType.TEXT,
          lessonNumber: Number(lessonNumber),
          part: { connect: { id: partId } },
          trialAllowed: trialAllowed || false,
          descriptionMD,
          title: title || "",
          content: content || "",
          status: LessonStatus.PENDING,
          user: { connect: { id: req.user.id } },
          thumbnailFileId: (thumbnail as File).id,
        },
      });
      const newLesson = await getLesson(lesson.id, reqUser.id);
      res.status(200).json(newLesson);
      await refreshCourse(courseId);
    } else {
      throw new HttpException(400, "Invalid lesson type");
    }
  };
  getLesson = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const id = req.gp<string>("id", undefined, String);
    const lesson = await getLesson(id, reqUser.id);
    if (!lesson) {
      throw new NotFoundException("lesson", id);
    }
    if (
      !(
        reqUser.id === lesson.userId ||
        reqUser.roles.find((_) => _.role.name === RoleEnum.ADMIN)
      )
    ) {
      throw new HttpException(403, "Forbidden");
    }
    return res.status(200).json(lesson);
  };
  getLessons = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const limit = Number(req.query.limit) || 12;
    const offset = Number(req.query.offset) || 0;
    const status = req.gp<LessonStatus>("status", null, LessonStatus);
    const { lessons, total } = await getLessons(
      reqUser.id,
      limit,
      offset,
      status,
    );
    res.status(200).json({ lessons, total, page: offset / limit + 1 });
  };

  updateLesson = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const id = req.gp<string>("id", undefined, String);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id, userId: reqUser.id },
    });
    if (!lesson) {
      throw new NotFoundException("lesson", id);
    }
    if (lesson.lessonType === LessonType.VIDEO) {
      const { lessonName, lessonNumber, partId, descriptionMD } = req.body;
      let trialAllowed = lesson.trialAllowed;
      if (req.body.trialAllowed) {
        trialAllowed = req.body.trialAllowed === "true";
      }
      const data: any = {
        lessonName: lessonName || lesson.lessonName,
        lessonNumber: Number(lessonNumber) || lesson.lessonNumber,
        part: { connect: { id: Number(partId || lesson.partId) } },
        trialAllowed: trialAllowed || lesson.trialAllowed,
        descriptionMD: descriptionMD || lesson.descriptionMD,
        status: LessonStatus.PENDING,
      };
      let video: File = null;
      const videoFile = req.fileModelsWithFieldName?.video
        ? req.fileModelsWithFieldName?.video.length === 1
          ? req.fileModelsWithFieldName?.video[0]
          : null
        : null;
      let thumbnail: File = null;
      const thumbnailFile = req.fileModelsWithFieldName?.thumbnail
        ? req.fileModelsWithFieldName?.thumbnail.length === 1
          ? req.fileModelsWithFieldName?.thumbnail[0]
          : null
        : null;
      if (videoFile) {
        video = videoFile;
      } else if (req.body.videoFileId) {
        video = { id: req.body.videoFileId } as File;
      } else {
        video = { id: lesson.videoFileId } as File;
      }
      if (thumbnailFile) {
        thumbnail = thumbnailFile;
      } else if (req.body.thumbnailFileId) {
        thumbnail = { id: req.body.thumbnailFileId } as File;
      } else {
        thumbnail = { id: lesson.thumbnailFileId } as File;
      }
      data.videoFileId = video.id;
      data.thumbnailFileId = thumbnail.id;
      await this.prisma.lesson.update({
        where: { id, userId: reqUser.id },
        data,
        include: { part: true },
      });
      const newLesson = await getLesson(id, reqUser.id);
      return res.status(200).json(newLesson);
    } else if (lesson.lessonType === LessonType.TEXT) {
      const {
        lessonName,
        lessonNumber,
        partId,
        trialAllowed,
        descriptionMD,
        title,
        content,
      } = req.body;

      let thumbnail: File = null;
      const thumbnailFile = req.fileModelsWithFieldName?.thumbnail
        ? req.fileModelsWithFieldName?.thumbnail.length === 1
          ? req.fileModelsWithFieldName?.thumbnail[0]
          : null
        : null;
      if (thumbnailFile) {
        thumbnail = thumbnailFile;
      } else if (req.body.thumbnailFileId) {
        thumbnail = { id: req.body.thumbnailFileId } as File;
      } else {
        thumbnail = { id: lesson.thumbnailFileId } as File;
      }
      await this.prisma.lesson.update({
        where: { id, userId: reqUser.id },
        data: {
          thumbnailFileId: thumbnail.id,
          lessonName: lessonName || lesson.lessonName,
          lessonNumber: Number(lessonNumber) || lesson.lessonNumber,
          part: { connect: { id: partId || lesson.partId } },
          trialAllowed: trialAllowed || lesson.trialAllowed,
          descriptionMD: descriptionMD || lesson.descriptionMD,
          status: LessonStatus.PENDING,
          title: title || lesson.title,
          content: content || lesson.content,
        },
        include: { part: true },
      });
      const newLesson = await getLesson(id, reqUser.id);
      return res.status(200).json(newLesson);
    } else {
      throw new HttpException(400, "Invalid lesson type");
    }
  };
  deleteLesson = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const id = req.gp<string>("id", undefined, String);
    const lesson = await getLesson(id, reqUser.id);
    if (!lesson) {
      throw new NotFoundException("lesson", id);
    }
    await deleteLesson(id);
    return res.status(200).json(lesson);
  };
  approveLesson = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const lesson = await this.prisma.lesson.findFirst({
      where: { id },
      include: { part: true },
    });
    if (!lesson) {
      throw new NotFoundException("lesson", id);
    }
    await this.prisma.lesson.update({
      where: { id },
      data: {
        status: LessonStatus.APPROVED,
      },
    });
    const lessons = await this.prisma.lesson.findMany({
      where: { part: { courseId: lesson.part.courseId } },
      include: { part: true },
    });
    for (const lesson of lessons) {
      if (lesson.status !== LessonStatus.APPROVED) {
        return res.status(200).json(lesson);
      }
    }
    await this.prisma.course.update({
      where: { id: lesson.part.courseId },
      data: { status: LessonStatus.APPROVED },
    });
    return res.status(200).json(lessons);
  };
}
