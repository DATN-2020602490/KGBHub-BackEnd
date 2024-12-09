import { BaseController } from "../../abstractions/base.controller";
import { KGBRequest, KGBResponse } from "../../global";

export default class ReportMockController extends BaseController {
  public path = "/api/v1/reports";

  public initializeRoutes() {
    this.router.get(`/system`, this.getMockSystemReport);
    this.router.get(`/author`, this.getMockAuthorReport);
    this.router.get(`/courses/stars`, this.getMockCoursesStarReport);
  }

  private randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generateDates(startDate: Date, endDate: Date, groupBy: string): string[] {
    const dates = [];
    const currentDate = new Date(startDate);
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

  getMockSystemReport = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", String);
    const startDate = new Date(req.gp<string | Date>("startDate", new Date(0), String));
    const endDate = new Date(req.gp<string | Date>("endDate", new Date(), String));

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
    }, {});

    const result = {
      groupBy,
      startDate,
      endDate,
      target: "system",
      systemReport: mockData,
    };
    return res.status(200).json(result);
  };

  getMockAuthorReport = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", String);
    const startDate = new Date(req.gp<string | Date>("startDate", new Date(0), String));
    const endDate = new Date(req.gp<string | Date>("endDate", new Date(), String));

    const periods = this.generateDates(startDate, endDate, groupBy);
    const mockData = periods.reduce((acc, period) => {
      acc[period] = {
        totalOriginalAmount: this.randomNumber(1000, 10000),
        totalAmount: this.randomNumber(900, 9000),
        totalOrder: this.randomNumber(10, 100),
      };
      return acc;
    }, {});

    const result = {
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
    };
    return res.status(200).json(result);
  };

  getMockCoursesStarReport = async (req: any, res: KGBResponse) => {
    const courses = ["Mock Course 1", "Mock Course 2", "Mock Course 3"];
    const mockData = courses.map((courseName, index) => {
      const total = this.randomNumber(50, 500);
      const stars = Array.from({ length: 5 }, (_, i) => ({
        star: i + 1,
        total: this.randomNumber(0, total / 5),
      }));
      const avgStar =
        stars.reduce((sum, s) => sum + s.star * s.total, 0) /
        stars.reduce((sum, s) => sum + s.total, 0);

      return {
        course: {
          id: (index + 1).toString(),
          name: courseName,
          thumbnailFile: {
            id: `file${index + 1}`,
            url: `https://example.com/thumbnail${index + 1}.jpg`,
          },
        },
        stars: [...stars, { avgStar: parseFloat(avgStar.toFixed(2)), total }],
      };
    });

    return res.status(200).json(mockData);
  };
}
