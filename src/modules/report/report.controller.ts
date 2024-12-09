import { BaseController } from "../../abstractions/base.controller";
import { CoursesPaid, KGBResponse, ReportTable, userSelector } from "../../global";
import { KGBAuth } from "../../configs/passport";
import { KGBRequest } from "../../global";
import checkRoleMiddleware from "../../middlewares/checkRole.middleware";
import { RoleEnum, CourseStatus, OrderStatus } from "@prisma/client";
import { groupOrdersByDate, processOrdersReportAuthor, processStarReport } from "./report.service";

export default class ReportController extends BaseController {
  public path = "/api/v1/reports";

  public initializeRoutes() {
    this.router.get(
      `/system`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      this.getSystemReport,
    );
    this.router.get(
      `/author`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.AUTHOR, RoleEnum.ADMIN]),
      this.getReportByAuthors,
    );
    this.router.get(
      `/courses/stars`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.AUTHOR]),
      this.getReportByCoursesStar,
    );
  }
  getSystemReport = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", String);
    const startDate = new Date(req.gp<string | Date>("startDate", new Date(0), String));
    const endDate = new Date(req.gp<string | Date>("endDate", new Date(), String));

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.SUCCESS,
        updatedAt: { gte: new Date(startDate), lte: new Date(endDate) },
      },
    });
    const result = {
      groupBy,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      target: "system",
      systemReport: groupOrdersByDate(orders, groupBy),
    } as ReportTable;
    return res.status(200).json(result);
  };

  getReportByAuthors = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", String);
    const startDate = new Date(req.gp<string | Date>("startDate", new Date(0), String));
    const endDate = new Date(req.gp<string | Date>("endDate", new Date(), String));
    const authorId = req.gp<string>("authorId", req.user.id, Number);
    const _ = (await this.prisma.coursesPaid.findMany({
      where: {
        isFree: false,
        course: { userId: authorId },
        order: {
          status: OrderStatus.SUCCESS,
          updatedAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      },
      include: { order: true, course: true },
    })) as CoursesPaid[];
    const author = await this.prisma.user.findFirst({
      where: { id: authorId },
      ...userSelector,
    });
    const result = {
      groupBy,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      target: "author",
      authorId: authorId,
      author,
      authorReport: processOrdersReportAuthor(_, groupBy),
    } as ReportTable;
    return res.status(200).json(result);
  };

  getReportByCoursesStar = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const courses = await this.prisma.course.findMany({
      where: { userId: reqUser.id, status: CourseStatus.APPROVED },
    });
    const coursesIds = courses.map((course) => course.id);
    const stars = await this.prisma.rating.findMany({
      where: { courseId: { in: coursesIds } },
      include: { course: true },
    });
    const result = stars.reduce((acc: any, star) => {
      if (!acc[star.courseId]) {
        acc[star.courseId] = [
          { star: 1, total: 0 },
          { star: 2, total: 0 },
          { star: 3, total: 0 },
          { star: 4, total: 0 },
          { star: 5, total: 0 },
          { avgStar: 0, total: 0 },
        ];
      }
      acc[star.courseId][star.star - 1].total += 1;
      acc[star.courseId][5].total = star.course.totalRating;
      acc[star.courseId][5].avgStar = star.course.avgRating;
      return acc;
    }, {});
    return res.status(200).json(await processStarReport(result));
  };
}
