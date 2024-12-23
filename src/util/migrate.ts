import {
  CampaignType,
  ChatMemberRole,
  ConversationType,
  Currency,
  LessonType,
  OrderStatus,
  ProductType,
  RoleEnum,
  UserView,
  VoucherType,
} from "@prisma/client";
import prisma from "../prisma";
import stripe from "../configs/stripe";
import { convert } from "html-to-text";
import {
  bindingPriceForProductOrder,
  getPlatformFee,
} from "../modules/stripe/stripe.service";
import BigNumber from "bignumber.js";
import { refreshCourse } from "../modules/course/course.service";
import { updateSearchAccent } from "../prisma/prisma.service";
import { handleCloudSaveConversation } from "../modules/chat/chat.service";
import { censorProfane } from ".";

type MigrateFunction = () => void;

const migrate = {
  handle: {} as any,

  async start() {
    const ranMigrates = await prisma.migrate.findMany({
      where: {
        name: {
          in: Object.keys(this.handle),
        },
      },
      select: {
        name: true,
      },
    });

    const ran: any = {};

    for (const migrate of ranMigrates) {
      ran[migrate.name] = true;
    }

    for (const name of Object.keys(this.handle)) {
      const handle = this.handle[name];

      if (ran[name]) {
        continue;
      }

      try {
        await handle();

        if (!name.startsWith("_")) {
          await prisma.migrate.create({
            data: {
              name,
            },
          });
        }

        console.log("Run migrate done:", name);
      } catch (error) {
        console.error("Run migrate error:", name, error);
      }
    }
  },

  init() {
    setTimeout(() => {
      this.start().catch((error) => {
        console.error("Migrate init error", error);
      });
    }, 1000);
  },

  add(name: string, handle: MigrateFunction) {
    if (this.handle[name]) {
      console.error(`Migrate ${name} already exists`);
    }

    this.handle[name] = handle;
  },
};

migrate.add("Init", async () => {
  console.log("Init migrate");
});

migrate.add("addRole", async () => {
  const roles = [RoleEnum.ADMIN, RoleEnum.AUTHOR, RoleEnum.USER];
  for (const role of roles) {
    await prisma.role.create({
      data: {
        name: role,
        description: role,
      },
    });
  }
});

migrate.add("html-to-text", async () => {
  const courses = await prisma.course.findMany({ include: { products: true } });
  for (const course of courses) {
    if (course.products.length > 0) {
      for (const product of course.products) {
        await stripe.products.update(product.productStripeId, {
          description: convert(course.descriptionMD),
        });
      }
    }
  }
});

migrate.add("add_cart", async () => {
  const users = await prisma.user.findMany({ include: { cart: true } });
  for (const user of users) {
    if (user.cart.length === 0) {
      await prisma.cart.create({
        data: {
          userId: user.id,
        },
      });
    }
  }
});

migrate.add("add_original_amount", async () => {
  const orders = await prisma.order.findMany({
    include: { coursesPaids: { include: { course: true } } },
  });
  for (const order of orders) {
    if (order.originalAmount) {
      continue;
    }
    const originalAmount = order.coursesPaids.reduce((acc, coursePaid) => {
      return acc + coursePaid.course.priceAmount;
    }, 0);
    const { originalFee } = await getPlatformFee(BigNumber(order.amount));
    await prisma.order.update({
      where: { id: order.id },
      data: {
        originalAmount,
        originalFee: originalFee.toNumber(),
      },
    });
  }
});

migrate.add("refresh_data", () => {
  prisma.course.findMany({}).then(async (_) => {
    for (const course of _) {
      await refreshCourse(course.id);
    }
  });
});

migrate.add("update_campaign", async () => {
  const campaigns = await prisma.campaign.findMany({
    include: { vouchers: true, campaignDiscounts: true },
  });
  for (const campaign of campaigns) {
    if (campaign.type === CampaignType.VOUCHERS) {
      const totalFeeVoucher =
        campaign.vouchers.filter((_) => _.type === VoucherType.FEE_PERCENTAGE)
          .length || 0;
      const feeVoucherValue =
        campaign.vouchers.find((_) => _.type === VoucherType.FEE_PERCENTAGE)
          ?.value || 0;
      const totalProductVoucher =
        campaign.vouchers.filter(
          (_) => _.type === VoucherType.PRODUCT_PERCENTAGE,
        ).length || 0;
      const productVoucherValue =
        campaign.vouchers.find((_) => _.type === VoucherType.PRODUCT_PERCENTAGE)
          ?.value || 0;

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          totalFeeVoucher,
          feeVoucherValue,
          totalProductVoucher,
          productVoucherValue,
        },
      });
    } else if (campaign.type === CampaignType.DISCOUNT) {
      let min = campaign.campaignDiscounts[0].value;
      let max = campaign.campaignDiscounts[0].value;
      for (const campaignDiscount of campaign.campaignDiscounts) {
        if (campaignDiscount.value < min) {
          min = campaignDiscount.value;
        }
        if (campaignDiscount.value > max) {
          max = campaignDiscount.value;
        }
      }
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          discountFrom: min,
          discountTo: max,
        },
      });
    }
  }
});

migrate.add("hotfix_chatMember", async () => {
  const coursePaids = await prisma.coursesPaid.findMany({
    where: { order: { status: OrderStatus.SUCCESS } },
    include: { course: { include: { conversations: true } } },
  });
  for (const cp of coursePaids) {
    for (const conversation of cp.course.conversations) {
      const chatMember = await prisma.chatMember.findFirst({
        where: { userId: cp.userId, conversationId: conversation.id },
      });
      if (!chatMember) {
        await prisma.chatMember.create({
          data: {
            conversationId: conversation.id,
            userId: cp.userId,
            chatMemberRole: ChatMemberRole.MEMBER,
          },
        });
      }
    }
  }
});

migrate.add("add_mimetype", async () => {
  const attachments = await prisma.attachment.findMany({});
  for (const attachment of attachments) {
    const file = await prisma.file.findUnique({
      where: { id: attachment.fileId },
    });
    if (!file) {
      continue;
    }
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { mimetype: file.mimetype },
    });
  }
});

migrate.add("add_original_name", async () => {
  const attachments = await prisma.attachment.findMany({});
  for (const attachment of attachments) {
    const file = await prisma.file.findUnique({
      where: { id: attachment.fileId },
    });
    if (!file) {
      continue;
    }
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { originalName: file.originalName },
    });
  }
});

migrate.add("re_stripe", async () => {
  const courses = await prisma.course.findMany({});
  for (const course of courses) {
    const product = await stripe.products.create({
      name: course.courseName,
      description: course.courseName,
      metadata: {
        userId: course.userId,
      },
      active: true,
      default_price_data: {
        currency: Currency.USD,
        unit_amount_decimal: String(0 * 100),
      },
    });
    await prisma.product.updateMany({
      where: { courseId: course.id },
      data: {
        productStripeId: product.id,
      },
    });
  }
});

migrate.add("remove_trash_data", async () => {
  await prisma.chatMembersOnMessages.deleteMany({
    where: {
      message: {
        conversation: {
          conversationType: ConversationType.COURSE_GROUP_CHAT,
          courseId: null,
        },
      },
    },
  });
  await prisma.message.deleteMany({
    where: {
      conversation: {
        conversationType: ConversationType.COURSE_GROUP_CHAT,
        courseId: null,
      },
    },
  });
  await prisma.chatMember.deleteMany({
    where: {
      conversation: {
        conversationType: ConversationType.COURSE_GROUP_CHAT,
        courseId: null,
      },
    },
  });
  await prisma.conversation.deleteMany({
    where: {
      conversationType: ConversationType.COURSE_GROUP_CHAT,
      courseId: null,
    },
  });
});

migrate.add("add_cloud_saves", async () => {
  const users = await prisma.user.findMany({});
  for (const user of users) {
    await handleCloudSaveConversation(user.id);
  }
});

migrate.add("add_search_accent", async () => {
  const users = await prisma.user.findMany({});
  for (const user of users) {
    await updateSearchAccent("user", user.id);
  }
  const lessons = await prisma.lesson.findMany({});
  for (const lesson of lessons) {
    await updateSearchAccent("lesson", lesson.id);
  }
  const courses = await prisma.course.findMany({});
  for (const course of courses) {
    await updateSearchAccent("course", course.id);
  }
  const conversations = await prisma.conversation.findMany({});
  for (const conversation of conversations) {
    await updateSearchAccent("conversation", conversation.id);
  }
  const messages = await prisma.message.findMany({});
  for (const message of messages) {
    await updateSearchAccent("message", message.id);
  }
  const comments = await prisma.comment.findMany({});
  for (const comment of comments) {
    await updateSearchAccent("comment", comment.id);
  }
  const campaigns = await prisma.campaign.findMany({});
  for (const campaign of campaigns) {
    await updateSearchAccent("campaign", campaign.id);
  }
  const attachments = await prisma.attachment.findMany({});
  for (const attachment of attachments) {
    await updateSearchAccent("attachment", attachment.id);
  }
});

migrate.add("lesson_duration", async () => {
  const lessons = await prisma.lesson.findMany({
    where: { lessonType: LessonType.VIDEO },
  });
  for (const lesson of lessons) {
    const file = await prisma.file.findFirst({
      where: { id: lesson.videoFileId },
    });
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { duration: file.duration || 0 },
    });
  }
});

migrate.add("add_product_order_price", async () => {
  const orders = await prisma.order.findMany({});
  for (const order of orders) {
    bindingPriceForProductOrder(order.id);
  }
});

migrate.add("remove_trash_data_chat", async () => {
  const conversation = await prisma.conversation.findMany({
    where: {
      conversationType: ConversationType.GROUP_CHAT,
    },
  });
  for (const cv of conversation) {
    try {
      await prisma.$transaction([
        prisma.chatMembersOnMessages.deleteMany({
          where: {
            message: {
              conversationId: cv.id,
            },
          },
        }),
        prisma.message.deleteMany({
          where: {
            conversationId: cv.id,
          },
        }),
        prisma.chatMember.deleteMany({
          where: {
            conversationId: cv.id,
          },
        }),
        prisma.conversation.deleteMany({
          where: {
            id: cv.id,
          },
        }),
      ]);
    } catch (e) {
      console.log(e);
    }
  }
});

migrate.add("sensor_data", async () => {
  const comment = await prisma.comment.findMany({});
  for (const cm of comment) {
    await prisma.comment.update({
      where: { id: cm.id },
      data: { content: censorProfane(cm.content) },
    });
  }
  const message = await prisma.message.findMany({});
  for (const msg of message) {
    await prisma.message.update({
      where: { id: msg.id },
      data: { content: censorProfane(msg.content) },
    });
  }
});

migrate.add("remove_old_stripe_data", async () => {
  const orders = await prisma.order.findMany({
    include: {
      productOrders: {
        include: {
          product: true,
        },
      },
    },
  });

  for (const order of orders) {
    let stripeOrder = null;
    try {
      stripeOrder = await stripe.checkout.sessions.retrieve(
        order.stripeCheckoutId as string,
      );
    } catch (e) {}
    if (stripeOrder) {
      continue;
    }
    try {
      order.productOrders = order.productOrders.filter((po) => {
        return po.product.type === ProductType.COURSE;
      });
      const ids = [
        ...new Set(order.productOrders.map((po) => po.product.courseId)),
      ];
      await prisma.coursesPaid.deleteMany({
        where: { orderId: order.id },
      });
      await prisma.courseDone.deleteMany({
        where: { courseId: { in: ids }, userId: order.userId },
      });
      await prisma.lessonDone.deleteMany({
        where: {
          lesson: { part: { courseId: { in: ids } } },
          userId: order.userId,
        },
      });
      await prisma.rating.deleteMany({
        where: {
          courseId: { in: ids },
          userId: order.userId,
        },
      });
      await prisma.bookmark.deleteMany({
        where: {
          courseId: { in: ids },
          userId: order.userId,
        },
      });
      await prisma.chatMembersOnMessages.deleteMany({
        where: {
          message: {
            conversation: {
              course: { id: { in: ids } },
              conversationType: ConversationType.COURSE_GROUP_CHAT,
            },
          },
          chatMember: {
            userId: order.userId,
            chatMemberRole: ChatMemberRole.MEMBER,
          },
        },
      });
      await prisma.message.deleteMany({
        where: {
          conversation: {
            course: { id: { in: ids } },
            conversationType: ConversationType.COURSE_GROUP_CHAT,
          },
          chatMembersOnMessages: {
            some: {
              userView: UserView.SENDER,
              chatMember: {
                userId: order.userId,
                chatMemberRole: ChatMemberRole.MEMBER,
              },
            },
          },
        },
      });
      await prisma.chatMember.deleteMany({
        where: {
          conversation: {
            course: { id: { in: ids } },
            conversationType: ConversationType.COURSE_GROUP_CHAT,
          },
          userId: order.userId,
          chatMemberRole: ChatMemberRole.MEMBER,
        },
      });
      await prisma.productOrder.deleteMany({
        where: { orderId: order.id },
      });
      await prisma.order.deleteMany({
        where: { id: order.id },
      });
      const cart = await prisma.cart.findFirst({
        where: { userId: order.userId },
      });
      ids.forEach(async (id) => {
        await refreshCourse(id);
        if (
          await prisma.coursesOnCarts.findFirst({
            where: { cartId: cart.id, courseId: id },
          })
        ) {
          return;
        }
        await prisma.coursesOnCarts.create({
          data: { cartId: cart.id, courseId: id },
        });
      });
    } catch (e) {
      console.log(e);
    }
  }
});

migrate.add("update_campaign_active", async () => {
  const campaigns = await prisma.campaign.findMany({
    where: {
      active: true,
    },
  });
  for (const campaign of campaigns) {
    if (campaign.endAt < new Date()) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { active: false },
      });
    }
  }
});

export default migrate;
