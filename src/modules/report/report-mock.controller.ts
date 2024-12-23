import { BaseController } from "../../abstractions/base.controller";
import { KGBRequest, KGBResponse } from "../../util/global";

export default class ReportMockController extends BaseController {
  public path = "/api/v1/reports";

  public initializeRoutes() {
    this.router.get(`/system`, this.getMockSystemReport);
    this.router.get(`/author`, this.getMockAuthorReport);
  }

  private randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generateDates(
    startDate: Date,
    endDate: Date,
    groupBy: string,
  ): string[] {
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

  private validateDateRange(
    startDate: Date,
    endDate: Date,
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    if (endDate > now) endDate = now; // Prevent future dates
    if (startDate > endDate)
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Ensure valid range
    return { startDate, endDate };
  }

  getMockSystemReport = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", ["day", "month", "year"]);
    let startDate = new Date(
      req.gp<string | Date>("startDate", new Date(0), String),
    );
    let endDate = new Date(
      req.gp<string | Date>("endDate", new Date(), String),
    );

    ({ startDate, endDate } = this.validateDateRange(startDate, endDate));

    const dates = this.generateDates(startDate, endDate, groupBy);
    const mockData = dates.reduce((acc, date) => {
      const totalOriginalAmount = this.randomNumber(500, 5000);
      acc[date] = {
        totalOriginalAmount,
        totalAmount: this.randomNumber(400, totalOriginalAmount),
        totalOrder: this.randomNumber(5, 50),
        totalFee: this.randomNumber(50, 500),
        totalTip: this.randomNumber(10, 200),
      };
      return acc;
    }, {} as Record<string, any>);

    return res.status(200).data({
      groupBy,
      startDate,
      endDate,
      target: "system",
      systemReport: mockData,
    });
  };

  getMockAuthorReport = async (req: KGBRequest, res: KGBResponse) => {
    const groupBy = req.gp<string>("groupBy", "day", ["day", "month", "year"]);
    let startDate = new Date(
      req.gp<string | Date>("startDate", new Date(0), String),
    );
    let endDate = new Date(
      req.gp<string | Date>("endDate", new Date(), String),
    );

    ({ startDate, endDate } = this.validateDateRange(startDate, endDate));

    const periods = this.generateDates(startDate, endDate, groupBy);
    const mockData = periods.reduce((acc, period) => {
      const totalOriginalAmount = this.randomNumber(1000, 10000);
      acc[period] = {
        totalOriginalAmount,
        totalAmount: this.randomNumber(900, totalOriginalAmount),
        totalOrder: this.randomNumber(10, 100),
      };
      return acc;
    }, {} as Record<string, any>);

    return res.status(200).data({
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
}
