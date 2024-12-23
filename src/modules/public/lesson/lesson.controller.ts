import { BaseController } from "../../../abstractions/base.controller";
import { KGBAuth } from "../../../configs/passport";
import HttpException from "../../../exceptions/http-exception";
import NotFoundException from "../../../exceptions/not-found";
import { LessonStatus, CourseStatus, OrderStatus } from "@prisma/client";
import { KGBRequest, KGBResponse } from "../../../util/global";

export default class PublicLessonController extends BaseController {
  public path = "/api/v1-public/lessons";

  public initializeRoutes() {
    this.router.post(`/actions/done`, KGBAuth("jwt"), this.doneLessonAction);
    this.router.get(`/:id`, KGBAuth("jwt"), this.getLesson);
  }

  getLesson = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    let lesson: any = await this.prisma.lesson.findFirst({
      where: {
        id,
        status: LessonStatus.APPROVED,
        part: { course: { isPublic: true, status: CourseStatus.APPROVED } },
      },
      include: { part: { include: { course: true } } },
    });
    if (!lesson) {
      throw new NotFoundException("lesson", id);
    }
    lesson = await this.prisma.lesson.findFirst({
      where: { id },
    });
    return res.status(200).data(lesson);
  };

  doneLessonAction = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const lessonId = req.gp<string>("lessonId", undefined, String);
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId },
      include: { part: true },
    });
    if (!lesson || lesson.status !== LessonStatus.APPROVED) {
      throw new NotFoundException("lesson", lessonId);
    }
    const paid = await this.prisma.coursesPaid.findFirst({
      where: {
        courseId: lesson.part.courseId,
        userId: reqUser.id,
        OR: [
          {
            isFree: true,
          },
          { order: { status: OrderStatus.SUCCESS } },
        ],
      },
    });
    if (!paid) {
      throw new HttpException(403, "You have not paid for this course");
    }
    const done = await this.prisma.lessonDone.findFirst({
      where: { lessonId, userId: reqUser.id },
    });
    if (!done) {
      const done = await this.prisma.lessonDone.create({
        data: {
          lesson: { connect: { id: lessonId } },
          user: { connect: { id: reqUser.id } },
        },
      });
      const parts = await this.prisma.part.findMany({
        where: { courseId: lesson.part.courseId },
      });
      const lessons = await this.prisma.lesson.findMany({
        where: {
          partId: { in: parts.map((_) => _.id) },
          status: LessonStatus.APPROVED,
        },
      });
      const lessonCount = await this.prisma.lesson.count({
        where: {
          part: { courseId: lesson.part.courseId },
          status: LessonStatus.APPROVED,
          userId: reqUser.id,
        },
      });
      if (lessonCount === lessons.length) {
        await this.prisma.courseDone.create({
          data: {
            course: { connect: { id: lesson.part.courseId } },
            user: { connect: { id: reqUser.id } },
          },
        });
      }
      return res.status(200).data(done);
    }
    await this.prisma.lessonDone.deleteMany({
      where: { lessonId, userId: reqUser.id },
    });
    await this.prisma.courseDone.deleteMany({
      where: { courseId: lesson.part.courseId, userId: reqUser.id },
    });
    return res.status(200).data(done);
  };
}
