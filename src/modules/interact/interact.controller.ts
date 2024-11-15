import { BaseController } from '../../abstractions/base.controller';
import { KGBResponse, userSelector } from '../../global';
import { KGBAuth } from '../../configs/passport';
import NotFoundException from '../../exceptions/not-found';
import HttpException from '../../exceptions/http-exception';
import { KGBRequest } from '../../global';
import { decodeJWT } from '../auth/auth.service';

export default class InteractController extends BaseController {
  public path = '/api/v1/interacts';

  public initializeRoutes() {
    this.router.post('/hearts', KGBAuth('jwt'), this.heartAction);
    this.router.post('/comments', KGBAuth('jwt'), this.createCommentAction);
    this.router.get('/', this.getInteracts);
    this.router.get('/user-interactions', KGBAuth('jwt'), this.getUserInteractions);
    this.router.patch('/comments/:id', KGBAuth('jwt'), this.updateCommentAction);
    this.router.delete('/comments/:id', KGBAuth('jwt'), this.deleteCommentAction);
  }

  getUserInteractions = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;

    const fetchData = async (model: any, userId: string) => {
      const data = await model.findMany({ where: { userId } });
      return {
        lessonIds: data.filter((item) => item.lessonId).map((item) => item.lessonId),
        courseIds: data.filter((item) => item.courseId).map((item) => item.courseId),
        messageIds: data.filter((item) => item.messageId).map((item) => item.messageId),
      };
    };

    const [hearts, comments] = await Promise.all([
      fetchData(this.prisma.heart, reqUser.id),
      fetchData(this.prisma.comment, reqUser.id),
    ]);

    const result = { hearts, comments };
    res.json(result);
  };

  getInteracts = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>('id', undefined, String);
    const limit = req.gp<number>('limit', 10, Number);
    const offset = req.gp<number>('offset', 0, Number);
    const targetResource = req.gp<string>('target_resource', undefined, String);
    if (!targetResource) {
      throw new HttpException(400, 'Missing target resource');
    }
    if (targetResource !== 'lesson' && targetResource !== 'course' && targetResource !== 'message') {
      throw new HttpException(400, 'Invalid target resource');
    }
    let comments =
      targetResource !== 'message'
        ? await this.prisma.comment.findMany({
            where: { [targetResource]: { id } },
            include: {
              user: userSelector,
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];
    const commentsCount = comments.length;
    comments = comments.slice(offset, offset + limit);
    const hears = await this.prisma.heart.findMany({
      where: { [targetResource]: { id } },
      include: {
        user: userSelector,
      },
    });
    let isHearted = false;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const reqUser = await decodeJWT(token);
      if (reqUser) {
        isHearted = !!hears.find((hear) => hear.userId === reqUser.id);
      }
    }

    const hearsCount = hears.length;

    if (targetResource === 'course') {
      let ratings = await this.prisma.rating.findMany({
        where: { courseId: id },
        include: {
          user: userSelector,
        },
        orderBy: { createdAt: 'desc' },
      });
      const ratingCount = ratings.length;
      ratings = ratings.slice(offset, offset + limit);
      return res.status(200).json({ comments, commentsCount, isHearted, hearsCount, ratings, ratingCount });
    }

    return res.status(200).json({ comments, commentsCount, isHearted, hearsCount });
  };

  heartAction = async (req: KGBRequest, res: KGBResponse) => {
    if (!req.body.id) {
      throw new HttpException(400, 'Missing id');
    }
    const id = req.gp<string>('id', undefined, String);
    const targetResource = req.body.target_resource as string;
    if (!targetResource) {
      throw new HttpException(400, 'Missing target resource');
    }
    const reqUser = req.user;
    const target = await (this.prisma[targetResource] as any).findFirst({
      where: { id },
    });

    if (!target) {
      throw new NotFoundException(targetResource, id);
    }

    const heart = await this.prisma.heart.findFirst({
      where: { userId: reqUser.id, [targetResource]: { id } },
    });

    if (heart) {
      await this.prisma.heart.delete({
        where: {
          id: heart.id,
        },
      });
      return res.status(200).json(heart);
    }

    const newHeart = await this.prisma.heart.create({
      data: {
        user: { connect: { id: reqUser.id } },
        [targetResource]: { connect: { id } },
      },
    });

    return res.status(200).json(newHeart);
  };

  createCommentAction = async (req: KGBRequest, res: KGBResponse) => {
    if (!req.body.id) {
      throw new HttpException(400, 'Missing id');
    }
    const id = req.gp<string>('id', undefined, String);
    const targetResource = req.body.target_resource as string;
    if (!targetResource) {
      throw new HttpException(400, 'Missing target resource');
    }

    const reqUser = req.user;

    const target = await (this.prisma[targetResource] as any).findFirst({ where: { id } });

    if (!target) {
      throw new NotFoundException(targetResource, id);
    }

    const { content, level } = req.body;

    if (!content) {
      throw new HttpException(400, 'Where tf is your comment content');
    }

    let comment;

    if (level === 0) {
      comment = await this.prisma.comment.create({
        data: {
          content,
          user: { connect: { id: reqUser.id } },
          [targetResource]: { connect: { id } },
          level: 0,
        },
      });
    } else if (level === 1 || level === 2) {
      const { parentId } = req.body;

      if (!(parentId || parentId == 0)) {
        throw new HttpException(400, 'parentId is missing');
      }

      comment = await this.prisma.comment.create({
        data: {
          content,
          level,
          user: { connect: { id: reqUser.id } },
          [targetResource]: { connect: { id } },
          parent: { connect: { id: parentId } },
        },
      });
    } else {
      throw new HttpException(400, 'Invalid level');
    }

    return res.status(200).json(comment);
  };

  updateCommentAction = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>('id', undefined, String);
    const reqUser = req.user;
    const comment = await this.prisma.comment.findFirst({ where: { id } });

    if (!comment) {
      throw new NotFoundException('comment', id);
    }

    if (comment.userId !== reqUser.id) {
      throw new HttpException(401, 'Unauthorized');
    }

    const { content } = req.body;
    await this.prisma.comment.update({ where: { id }, data: { content } });
    const newComment = await this.prisma.comment.findFirst({ where: { id } });

    return res.status(200).json(newComment);
  };

  deleteCommentAction = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>('id', undefined, String);
    const reqUser = req.user;

    const comment = await this.prisma.comment.findFirst({
      where: { id },
      include: { children: { include: { children: true } } },
    });

    if (!comment) {
      throw new NotFoundException('comment', id);
    }

    if (comment.userId !== reqUser.id) {
      throw new HttpException(401, 'Unauthorized');
    }

    if (comment.level === 0) {
      const comments = await this.prisma.comment.findMany({
        where: { parentId: id },
      });

      for (const comment of comments) {
        await this.prisma.comment.deleteMany({
          where: { parentId: comment.id },
        });
        await this.prisma.comment.delete({ where: { id: comment.id } });
      }
      await this.prisma.comment.delete({ where: { id } });
    } else if (comment.level === 1) {
      await this.prisma.comment.deleteMany({
        where: { parentId: id },
      });
      await this.prisma.comment.delete({
        where: { id },
      });
    } else if (comment.level === 2) {
      await this.prisma.comment.delete({
        where: { id },
      });
    }

    return res.status(200).json(comment);
  };
}
