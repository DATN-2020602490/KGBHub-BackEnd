import { BaseController } from "../../../abstractions/base.controller";
import { KGBAuth } from "../../../configs/passport";
import NotFoundException from "../../../exceptions/not-found";
import { CourseCategory, CourseStatus, OrderStatus } from "@prisma/client";
import {
  Course,
  KGBRequest,
  KGBResponse,
  limitDefault,
  offsetDefault,
  userSelector,
} from "../../../util/global";
import { removeAccent } from "../../../prisma/prisma.service";
import { checkBadWord } from "../../../util";

export default class PublicCourseController extends BaseController {
  public path = "/api/v1-public/courses";

  public initializeRoutes() {
    this.router.get(`/`, KGBAuth(["jwt", "anonymous"]), this.getCourses);
    this.router.get(`/:id`, KGBAuth(["jwt", "anonymous"]), this.getCourse);
  }

  getCourses = async (req: KGBRequest, res: KGBResponse) => {
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const search = req.gp<string>("search", null, checkBadWord);
    const categories = req.query.categories || "";
    const orderBy = (req.query.orderBy as string) || "createdAt";
    const direction = (req.query.direction as "asc" | "desc") || "desc";
    const isBestSeller = req.query.isBestSeller === "true";
    const byAuthor = req.gp<string>("byAuthor", null, String);

    const query: any = {
      where: {
        isPublic: true,
        status: CourseStatus.APPROVED,
      },
      orderBy: [
        {
          [orderBy]: direction,
        },
      ],
    };
    if (categories) {
      const category = String(categories).split(",") as CourseCategory[];
      query.where.category = {
        in: category,
      };
    }

    if (byAuthor) {
      query.where.userId = byAuthor;
    }

    if (search) {
      query.where.OR = [
        {
          searchAccent: { contains: removeAccent(search) },
        },
        {
          user: { searchAccent: { contains: removeAccent(search) } },
        },
      ];
    }
    const total = await this.prisma.course.count({
      where: { ...query.where },
    });
    if (!isBestSeller) {
      query.take = limit;
      query.skip = offset;
    }

    const courses = (await this.prisma.course.findMany({
      ...query,
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
    let bestSellerCourses = [] as any[];
    if (isBestSeller) {
      courses.sort((a: Course, b: Course) => {
        return b.coursesPaid.length - a.coursesPaid.length;
      });
      bestSellerCourses = courses.slice(offset, offset + limit);
    }
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
                {
                  isFree: true,
                },
                {
                  order: { status: OrderStatus.SUCCESS },
                },
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
    return res
      .status(200)
      .data(isBestSeller ? bestSellerCourses : courses, total);
  };

  getCourse = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const course = await this.prisma.course.findFirst({
      where: { id, isPublic: true, status: CourseStatus.APPROVED },
      include: {
        user: userSelector,
        coursesPaid: {
          include: {
            order: {
              include: { vouchers: true },
            },
            user: userSelector,
          },
        },

        parts: {
          include: {
            lessons: true,
          },
        },
      },
    });
    if (!course) {
      throw new NotFoundException("course", id);
    }
    course["totalBought"] = course.coursesPaid.filter(
      (cp) =>
        (cp.order && cp.order.status === OrderStatus.SUCCESS) || cp.isFree,
    ).length;

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
              {
                isFree: true,
              },
              {
                order: { status: OrderStatus.SUCCESS },
              },
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
    return res.status(200).data(course);
  };
}
