import { CourseStatus } from "@prisma/client";
import { BaseController } from "../../abstractions/base.controller";
import { Course, KGBRequest, KGBResponse, Rating } from "../../global";
import { KGBAuth } from "../../configs/passport";

export default class ReportMockController extends BaseController {
  public path = "/api/v1/reports";

  public initializeRoutes() {
    this.router.get(`/system`, this.getMockSystemReport);
    this.router.get(`/author`, this.getMockAuthorReport);
    this.router.get(`/courses/stars`, KGBAuth("jwt"), this.getMockCoursesStarReport);
  }

  /**
   * Generate a random number between min and max (inclusive).
   */
  private randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate an array of dates based on the given range and grouping option.
   */
  private generateDates(startDate: Date, endDate: Date, groupBy: string): string[] {
    const dates = [];
    const currentDate = new Date(startDate);

    // Limit maximum range to 1 year to prevent overload
    // const maxEndDate = new Date(startDate);
    // maxEndDate.setFullYear(startDate.getFullYear() + 1);
    // endDate = endDate > maxEndDate ? maxEndDate : endDate;

    while (currentDate <= endDate) {
      if (groupBy === "day") {
        dates.push(currentDate.toISOString().split("T")[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (groupBy === "month") {
        dates.push(currentDate.toISOString().slice(0, 7));
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (groupBy === "year") {
        dates.push(currentDate.toISOString().slice(0, 4));
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      }
    }
    return dates;
  }

  private validateDateRange(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
    // const now = new Date();
    // if (endDate > now) endDate = now; // Prevent future dates
    // if (startDate > endDate) startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Ensure valid range
    return { startDate, endDate };
  }

  getMockSystemReport = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", String);
    let startDate = new Date(req.gp<string | Date>("startDate", new Date(0), String));
    let endDate = new Date(req.gp<string | Date>("endDate", new Date(), String));

    ({ startDate, endDate } = this.validateDateRange(startDate, endDate));

    const dates = this.generateDates(startDate, endDate, groupBy);
    const mockData = dates.reduce((acc, date) => {
      acc[date] = {
        totalOriginalAmount: this.randomNumber(500, 5000),
        totalAmount: this.randomNumber(400, 4500),
        totalOrder: this.randomNumber(5, 50),
        totalFee: this.randomNumber(50, 500),
        totalTip: this.randomNumber(10, 200),
      };
      return acc;
    }, {} as Record<string, any>);

    return res.status(200).json({
      groupBy,
      startDate,
      endDate,
      target: "system",
      systemReport: mockData,
    });
  };

  getMockAuthorReport = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", String);
    let startDate = new Date(req.gp<string | Date>("startDate", new Date(0), String));
    let endDate = new Date(req.gp<string | Date>("endDate", new Date(), String));

    ({ startDate, endDate } = this.validateDateRange(startDate, endDate));

    const periods = this.generateDates(startDate, endDate, groupBy);
    const mockData = periods.reduce((acc, period) => {
      acc[period] = {
        totalOriginalAmount: this.randomNumber(1000, 10000),
        totalAmount: this.randomNumber(900, 9000),
        totalOrder: this.randomNumber(10, 100),
      };
      return acc;
    }, {} as Record<string, any>);

    return res.status(200).json({
      groupBy,
      startDate,
      endDate,
      target: "author",
      authorId: "12345",
      author: {
        id: "12345",
        name: "Author Mock",
        email: "author.mock@example.com",
      },
      authorReport: mockData,
    });
  };

  mockRates = (course: Course) => {
    const data = [] as Rating[];
    const usersLength = this.randomNumber(20, 50);
    for (let i = 0; i < usersLength; i++) {
      const star = this.randomNumber(1, 5);
      data.push({ courseId: course.id, course, star, userId: `user-${i}` } as any);
    }
    const totalStar = data.reduce((acc, item) => acc + item.star, 0);
    const avgStar = totalStar / usersLength;
    for (let i = 0; i < usersLength; i++) {
      data[i]["course"]["totalRating"] = totalStar;
      data[i]["course"]["avgRating"] = avgStar;
    }
    return data;
  };

  getMockCoursesStarReport = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const courses = (await this.prisma.course.findMany({
      where: { userId: reqUser.id, status: CourseStatus.APPROVED },
    })) as Course[];
    const stars = [] as Rating[];
    for (const course of courses) {
      stars.push(...this.mockRates(course));
    }
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
    const total = {
      course: { id: -1, name: "Total" },
      stars: [
        { star: 1, total: 0 },
        { star: 2, total: 0 },
        { star: 3, total: 0 },
        { star: 4, total: 0 },
        { star: 5, total: 0 },
        { avgStar: 0, total: 0 },
      ],
    };
    let totalRate = 0;
    let totalStar = 0;
    const _result = [] as any[];
    for (const _ in result) {
      const course = stars.find((item) => item.courseId === _).course;
      totalRate += course.totalRating;
      totalStar += course.avgRating * course.totalRating;
      _result.push({
        course: {
          id: course.id,
          name: course.courseName,
          thumbnailFileId: course.thumbnailFileId,
        },
        stars: result[_],
      });
      for (const __ of result[_]) {
        if (!__.star) {
          continue;
        }
        total.stars[__.star - 1].total += __.total;
      }
    }
    total.stars[5].avgStar = totalStar / totalRate;
    total.stars[5].total = totalRate;
    _result.push(total);
    return res.status(200).json(_result);
  };
}
