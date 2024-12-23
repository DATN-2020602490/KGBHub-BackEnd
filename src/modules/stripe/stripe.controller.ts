import { BaseController } from "../../abstractions/base.controller";
import express from "express";
import stripe from "../../configs/stripe";
import {
  KGBRequest,
  KGBResponse,
  limitDefault,
  offsetDefault,
  userSelector,
} from "../../util/global";
import {
  bindingPriceForProductOrder,
  createLineItems,
  notPaidCourses,
  onStripeHook,
} from "./stripe.service";
import {
  CourseStatus,
  Currency,
  OrderStatus,
  ProductType,
} from "@prisma/client";
import HttpException from "../../exceptions/http-exception";
import NotFoundException from "../../exceptions/not-found";
import BigNumber from "bignumber.js";
import { KGBAuth } from "../../configs/passport";

export default class StripeController extends BaseController {
  public path = "/api/v1/stripe";

  public initializeRoutes() {
    this.router.post(
      "/webhook",
      express.raw({ type: "application/json" }),
      this.handleWebhook,
    );
    this.router.post("/buy-course", KGBAuth("jwt"), this.buyCourse);
    this.router.post(
      "/checkout-from-cart",
      KGBAuth("jwt"),
      this.checkoutFromCart,
    );
    this.router.get("/orders", this.getOrders);
    this.router.get("/orders/:id", this.getOrder);
  }

  handleWebhook = async (req: KGBRequest, res: KGBResponse) => {
    const sig = req.headers["stripe-signature"];

    const event = stripe.webhooks.constructEvent(
      (req as any).rawBody,
      sig as string | string[],
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );

    onStripeHook(event, this.io).then((error) => {
      console.error("paymentService.onStripeHook error", error);
    });

    return res.status(200).data({ received: true });
  };

  buyCourse = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const id = req.gp<string>("courseId", undefined, String);
    const code = req.gp<string>("code", "NO_CODE", String);
    let voucher = null;
    if (code !== "NO_CODE") {
      voucher = await this.prisma.voucher.findFirst({
        where: { code },
      });
      if (!voucher) {
        throw new NotFoundException("voucher", code);
      }
    }
    const course = await this.prisma.course.findFirst({
      where: { id },
      include: { coursesPaid: true, products: true },
    });
    if (!course) {
      throw new NotFoundException("course", id);
    }
    if (!course.isPublic || course.status !== CourseStatus.APPROVED) {
      throw new HttpException(403, "Forbidden");
    }
    const user = await this.prisma.user.findFirst({
      where: { id: reqUser.id },
      include: { coursesPaid: true },
    });
    if (!user) {
      throw new NotFoundException("user", reqUser.id);
    }
    const ids = await notPaidCourses(reqUser.id, [id]);
    if (ids.length === 0) {
      throw new HttpException(400, "Course already paid");
    }
    const tipPercent = req.gp<number>("tipPercent", 0, Number);
    const {
      line_items,
      platformFee,
      tip,
      totalAmount,
      originalAmount,
      originalFee,
    } = await createLineItems(req.user.id, ids, tipPercent, code);
    const success_url = req.gp<string>(
      "successUrl",
      process.env.PUBLIC_URL,
      String,
    );
    if (line_items.length === 0) {
      res.status(200).data({
        checkoutUrl: success_url,
      });
    }
    const checkout = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      success_url,
    });
    const order = await this.prisma.order.create({
      data: {
        platformFee: BigNumber(platformFee.unit_amount_decimal)
          .div(100)
          .toNumber(),
        KGBHubServiceTip: tip
          ? BigNumber(tip.unit_amount_decimal).div(100).toNumber()
          : 0,
        amount: BigNumber(totalAmount).toNumber(),
        currency: course.currency as Currency,
        status: OrderStatus.PENDING,
        expiresAt: new Date(checkout.expires_at * 1000),
        user: { connect: { id: reqUser.id } },
        stripeCheckoutId: checkout.id,
        checkoutUrl: checkout.url,
        originalAmount: BigNumber(originalAmount).toNumber(),
        originalFee: BigNumber(originalFee).toNumber(),
      },
    });
    await this.prisma.coursesPaid.create({
      data: {
        user: { connect: { id: reqUser.id } },
        course: { connect: { id } },
        order: { connect: { id: order.id } },
      },
    });
    res.status(200).data(order);
    await bindingPriceForProductOrder(order.id);
  };

  checkoutFromCart = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const code = req.gp<string>("code", "NO_CODE", String);
    const cart = await this.prisma.cart.findFirst({
      where: { userId: reqUser.id },
      include: { coursesOnCarts: { include: { course: true } } },
    });
    if (!cart) {
      throw new NotFoundException("cart", reqUser.id);
    }
    if (cart.coursesOnCarts.length === 0) {
      throw new HttpException(400, "Cart is empty");
    }
    let { courseIds } = req.body;
    if (courseIds instanceof String) {
      courseIds = JSON.parse(courseIds as string);
    }
    courseIds = await notPaidCourses(reqUser.id, courseIds);
    if (courseIds.length === 0) {
      throw new HttpException(400, "Courses already paid");
    }
    const tipPercent = req.gp<number>("tipPercent", 0, Number);
    const {
      line_items,
      platformFee,
      tip,
      totalAmount,
      originalAmount,
      originalFee,
    } = await createLineItems(req.user.id, courseIds, tipPercent, code);
    const success_url = req.gp<string>(
      "successUrl",
      process.env.PUBLIC_URL,
      String,
    );
    const checkout = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      success_url,
    });
    const order = await this.prisma.order.create({
      data: {
        platformFee: BigNumber(platformFee.unit_amount_decimal)
          .div(100)
          .toNumber(),
        KGBHubServiceTip: tip
          ? BigNumber(tip.unit_amount_decimal).div(100).toNumber()
          : 0,
        amount: BigNumber(totalAmount).toNumber(),
        currency: Currency.USD,
        status: OrderStatus.PENDING,
        expiresAt: new Date(checkout.expires_at * 1000),
        user: { connect: { id: reqUser.id } },
        stripeCheckoutId: checkout.id,
        checkoutUrl: checkout.url,
        originalAmount: BigNumber(originalAmount).toNumber(),
        originalFee: BigNumber(originalFee).toNumber(),
      },
    });
    for (const _ of courseIds) {
      await this.prisma.coursesPaid.create({
        data: {
          course: { connect: { id: _ } },
          user: { connect: { id: reqUser.id } },
          order: { connect: { id: order.id } },
        },
      });
    }
    res.status(200).data(order);
    await bindingPriceForProductOrder(order.id);
  };

  getOrders = async (req: KGBRequest, res: KGBResponse) => {
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const userId = req.gp<string>("userId", null, String);
    const where = {};
    if (userId) {
      where["userId"] = userId;
    }
    const orders = await this.prisma.order.findMany({
      where,
      include: { user: userSelector },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: "desc" },
    });
    for (const order of orders) {
      order.amount = order.amount + order.platformFee + order.KGBHubServiceTip;
    }
    const total = await this.prisma.order.count({ where });
    return res.status(200).data(orders, total);
  };

  getOrder = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const order = await this.prisma.order.findFirst({
      where: { id },
      include: {
        user: userSelector,
        productOrders: { include: { product: true } },
      },
    });
    order.amount = order.amount + order.platformFee + order.KGBHubServiceTip;

    const tipProduct = order.productOrders.find(
      (po) => po.product.type === ProductType.KGBHUB_SERVICE_TIP,
    );
    const platformFeeProduct = order.productOrders.find(
      (po) => po.product.type === ProductType.STRIPE_SERVICE_FEE,
    );
    const elseProducts = order.productOrders.filter(
      (po) =>
        po.product.type !== ProductType.KGBHUB_SERVICE_TIP &&
        po.product.type !== ProductType.STRIPE_SERVICE_FEE,
    );
    order.productOrders = [tipProduct, platformFeeProduct, ...elseProducts];
    return res.status(200).data(order);
  };
}
