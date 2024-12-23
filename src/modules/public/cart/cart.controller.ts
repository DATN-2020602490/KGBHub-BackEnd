import { BaseController } from "../../../abstractions/base.controller";
import { KGBAuth } from "../../../configs/passport";
import NotFoundException from "../../../exceptions/not-found";
import HttpException from "../../../exceptions/http-exception";
import { CourseStatus, OrderStatus } from "@prisma/client";
import { KGBRequest, KGBResponse } from "../../../util/global";

export default class CartController extends BaseController {
  public path = "/api/v1-public/carts";

  public initializeRoutes() {
    this.router.get(`/`, KGBAuth("jwt"), this.getCart);
    this.router.post(`/actions/add`, KGBAuth("jwt"), this.addToCart);
    this.router.post(`/actions/remove`, KGBAuth("jwt"), this.removeFromCart);
    this.router.post(`/actions/clear`, KGBAuth("jwt"), this.clearCart);
  }

  addToCart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const cart = await this.prisma.cart.findFirst({
      where: { userId: reqUser.id },
    });
    if (!cart) {
      throw new NotFoundException("cart", reqUser.id);
    }
    const courseId = req.gp<string>("courseId", undefined, String);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException("course", courseId);
    }
    if (course.status !== CourseStatus.APPROVED) {
      throw new HttpException(400, "Course is not approved");
    }
    const cOC = await this.prisma.coursesOnCarts.findFirst({
      where: { cartId: cart.id, courseId },
    });
    if (cOC) {
      throw new Error("Course already added to cart");
    }
    const isBought = await this.prisma.coursesPaid.findFirst({
      where: {
        courseId,
        userId: reqUser.id,
        OR: [
          {
            isFree: true,
          },
          {
            order: { status: OrderStatus.SUCCESS },
          },
        ],
      },
      include: { order: true },
    });
    if (isBought) {
      throw new HttpException(400, "Course already bought");
    }
    await this.prisma.coursesOnCarts.create({
      data: {
        cart: { connect: { id: cart.id } },
        course: { connect: { id: courseId } },
      },
    });
    const _ = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: { coursesOnCarts: { include: { course: true } } },
    });
    return res.status(200).data(_);
  };
  removeFromCart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const cart = await this.prisma.cart.findFirst({
      where: { userId: reqUser.id },
    });
    if (!cart) {
      throw new NotFoundException("cart", reqUser.id);
    }
    const { courseIds } = req.body;
    for (const __ of courseIds) {
      const courseId = __;
      const course = await this.prisma.course.findFirst({
        where: { id: courseId },
      });
      if (!course) {
        continue;
      }
      console.log(courseId);

      const cOC = await this.prisma.coursesOnCarts.findFirst({
        where: { cartId: cart.id, courseId },
      });
      console.log(cart.id);

      if (!cOC) {
        continue;
      }
      console.log(cOC);

      await this.prisma.coursesOnCarts.deleteMany({
        where: { cartId: cart.id, courseId },
      });
    }

    const _ = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: { coursesOnCarts: { include: { course: true } } },
    });
    return res.status(200).data(_);
  };
  clearCart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const cart = await this.prisma.cart.findFirst({
      where: { userId: reqUser.id },
    });
    if (!cart) {
      throw new NotFoundException("cart", reqUser.id);
    }
    await this.prisma.coursesOnCarts.deleteMany({
      where: { cartId: cart.id },
    });
    const _ = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: { coursesOnCarts: { include: { course: true } } },
    });
    return res.status(200).data(_);
  };
  getCart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const cart = await this.prisma.cart.findFirst({
      where: { userId: reqUser.id },
      include: { coursesOnCarts: { include: { course: true } } },
    });
    if (!cart) {
      throw new NotFoundException("cart", reqUser.id);
    }
    return res.status(200).data(cart);
  };
}
