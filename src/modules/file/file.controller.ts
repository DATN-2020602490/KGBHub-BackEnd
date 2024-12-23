import { BaseController } from "../../abstractions/base.controller";
import { KGBResponse } from "../../util/global";
import path from "path";
import { createReadStream, existsSync, statSync } from "fs";
import HttpException from "../../exceptions/http-exception";
import { KGBAuth } from "../../configs/passport";
import { OrderStatus, RoleEnum } from "@prisma/client";
import checkRoleMiddleware from "../../middlewares/checkRole.middleware";
import { KGBRequest } from "../../util/global";
import { fileMiddleware } from "../../middlewares/file.middleware";
import { decodeJWT } from "../auth/auth.service";

export default class FileController extends BaseController {
  public path = "/api/v1/files";

  public initializeRoutes() {
    this.router.get(`/:id`, this.getFile);
    this.router.post(
      `/`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.ADMIN, RoleEnum.AUTHOR]),
      fileMiddleware([{ name: "image", maxCount: 1 }]),
      this.uploadFile,
    );
  }
  uploadFile = async (req: KGBRequest, res: KGBResponse) => {
    return res.data(req.fileModelsWithFieldName);
  };
  getFile = async (req: KGBRequest, res: KGBResponse) => {
    const fileId = req.gp<string>("id", undefined, String);
    if (fileId === "my-files") {
      if (!req.user) {
        throw new HttpException(403, "Forbidden");
      }
      const files = await this.prisma.file.findMany({
        where: { ownerId: req.user.id },
      });
      return res.data(files);
    }
    let file = await this.prisma.file.findFirst({
      where: { id: fileId },
    });
    if (!file) {
      file = await this.prisma.file.findFirst({
        where: { filename: "0.jpg" },
      });
    }

    let filename = file.filename;
    const isExist = existsSync(`uploads/${filename}`);
    if (!isExist) {
      // throw new NotFoundException("file", filename);
      filename = "0.jpg";
    }
    const fileType = ["jpeg", "jpg", "png", "gif", "svg"].includes(
      filename.split(".")[1],
    )
      ? "image"
      : ["mp4", "mov"].includes(filename.split(".")[1])
      ? "video"
      : "unknown";
    const encodedFileName = encodeURIComponent(file.originalName);
    if (fileType === "image" || fileType === "unknown") {
      const _path = path.resolve(`uploads/${filename}` as string);
      const stat = statSync(_path);
      const fileSize = stat.size;
      const head = {
        "Content-Length": fileSize,
        "Content-Type":
          fileType === "image"
            ? `image/${filename.split(".")[1]}`
            : "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodedFileName}"`,
      };
      res.writeHead(200, head);
      createReadStream(_path).pipe(res);
    } else if (fileType === "video") {
      const lesson = await this.prisma.lesson.findFirst({
        where: { videoFileId: fileId },
        include: {
          part: true,
        },
      });
      const attachment = await this.prisma.attachment.findFirst({
        where: { fileId },
        include: {
          message: true,
        },
      });

      if (!lesson && !attachment) {
        throw new HttpException(403, "Forbidden");
      }

      if (lesson && !lesson.trialAllowed) {
        const token = req.gp<string>("token", undefined, String);
        const reqUser = await decodeJWT(token as string);
        const user = await this.prisma.user.findFirst({
          where: { id: reqUser.id },
          include: {
            coursesPaid: {
              where: {
                courseId: lesson.part.courseId,
                order: { status: OrderStatus.SUCCESS },
              },
            },
          },
        });

        const hasAccess =
          reqUser.roles.some((role) => role.role.name === RoleEnum.ADMIN) ||
          reqUser.id === lesson.userId ||
          (user?.coursesPaid.length ?? 0) > 0;

        if (!hasAccess) {
          throw new HttpException(403, "Forbidden");
        }
      }

      // if (
      //   attachment &&
      //   (!attachment.message ||
      //     !(await this.prisma.chatMember.findFirst({
      //       where: {
      //         conversationId: attachment.conversationId,
      //         userId: reqUser.id,
      //       },
      //     })))
      // ) {
      //   if (
      //     !reqUser.roles.some((role) => role.role.name === RoleEnum.ADMIN) ||
      //     reqUser.id !== attachment.userId
      //   ) {
      //     throw new HttpException(403, "Forbidden");
      //   }
      // }

      const videoPath = path.resolve(file.localPath as string);
      const stat = statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunksize = end - start + 1;
        const file = createReadStream(videoPath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
        };

        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
        };
        res.writeHead(200, head);
        createReadStream(videoPath).pipe(res);
      }
    }
  };
}
