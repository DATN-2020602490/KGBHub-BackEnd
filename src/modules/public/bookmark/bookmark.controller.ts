import { BaseController } from "../../../abstractions/base.controller";
import { KGBAuth } from "../../../configs/passport";
import NotFoundException from "../../../exceptions/not-found";
import { Bookmark, KGBRequest, KGBResponse, File } from "../../../util/global";

export default class BookmarkController extends BaseController {
  public path = "/api/v1-public/bookmarks";

  public initializeRoutes() {
    this.router.get(`/`, KGBAuth("jwt"), this.getBookmarks);
    this.router.post(`/`, KGBAuth("jwt"), this.addBookmark);
    this.router.delete(`/:id`, KGBAuth("jwt"), this.removeBookmark);
  }

  getBookmarks = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const userId = reqUser.id;
    const bookmarks = (await this.prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { courseName: true, thumbnailFileId: true } },
        lesson: {
          select: {
            thumbnailFileId: true,
            part: {
              select: { courseId: true },
            },
            lessonName: true,
          },
        },
      },
    })) as any[] as Bookmark[];
    for (const bookmark of bookmarks) {
      if (bookmark.courseId) {
        const thumbnail = (await this.prisma.file.findFirst({
          where: { id: bookmark.course.thumbnailFileId },
        })) as File;
        bookmark.course.thumbnailFile = thumbnail;
      }
      if (bookmark.lessonId) {
        const thumbnail = (await this.prisma.file.findFirst({
          where: { id: bookmark.lesson.thumbnailFileId },
        })) as File;
        bookmark.lesson.thumbnailFile = thumbnail;
      }
    }
    return res.status(200).data(bookmarks);
  };
  addBookmark = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const userId = reqUser.id;
    const { courseId, lessonId } = req.body;
    let bookmark;
    if (courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: courseId },
      });
      if (!course) {
        throw new NotFoundException("course", courseId);
      }
      const _ = await this.prisma.bookmark.findFirst({
        where: { courseId, userId },
      });
      if (_) {
        throw new Error("Bookmark already exists");
      }
      bookmark = await this.prisma.bookmark.create({
        data: {
          course: { connect: { id: courseId } },
          user: { connect: { id: userId } },
        },
      });
    } else if (lessonId) {
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: lessonId },
      });
      if (!lesson) {
        throw new NotFoundException("lesson", lessonId);
      }
      const _ = await this.prisma.bookmark.findFirst({
        where: { lessonId, userId },
      });
      if (_) {
        throw new Error("Bookmark already exists");
      }
      bookmark = await this.prisma.bookmark.create({
        data: {
          lesson: { connect: { id: lessonId } },
          user: { connect: { id: userId } },
        },
      });
    } else {
      throw new Error("Invalid courseId or lessonId provided");
    }
    return res.status(200).data(bookmark);
  };
  removeBookmark = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const userId = reqUser.id;
    const id = req.gp<string>("id", undefined, String);
    const bookmark = await this.prisma.bookmark.findFirst({
      where: { id },
    });
    if (!bookmark) {
      throw new NotFoundException("bookmark", id);
    }
    if (bookmark.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await this.prisma.bookmark.delete({ where: { id } });
    return res.status(200).data(bookmark);
  };
}
