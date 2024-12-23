import { BaseController } from "../../abstractions/base.controller";
import {
  CoursesPaid,
  KGBResponse,
  ReportTable,
  userSelector,
} from "../../util/global";
import { KGBAuth } from "../../configs/passport";
import { KGBRequest } from "../../util/global";
import checkRoleMiddleware from "../../middlewares/checkRole.middleware";
import { RoleEnum, OrderStatus } from "@prisma/client";
import { groupOrdersByDate, processOrdersReportAuthor } from "./report.service";

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
  }
  getSystemReport = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", ["day", "month", "year"]);
    const startDate = new Date(
      req.gp<string | Date>("startDate", new Date(0), String),
    );
    const endDate = new Date(
      req.gp<string | Date>("endDate", new Date(), String),
    );

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
    return res.status(200).data(result);
  };

  getReportByAuthors = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", ["day", "month", "year"]);
    const startDate = new Date(
      req.gp<string | Date>("startDate", new Date(0), String),
    );
    const endDate = new Date(
      req.gp<string | Date>("endDate", new Date(), String),
    );
    const authorId = req.gp<string>("authorId", req.user.id, String);
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
    return res.status(200).data(result);
  };
}
