import { CampaignType, ChatMemberRole, OrderStatus, RoleEnum, VoucherType } from "@prisma/client";
import prisma from "./configs/prisma";
import stripe from "./configs/stripe";
import { convert } from "html-to-text";
import { getPlatformFee } from "./modules/stripe/stripe.service";
import BigNumber from "bignumber.js";
import { refreshCourse } from "./modules/course/course.service";

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
      const totalFeeVoucher = campaign.vouchers.filter((_) => _.type === VoucherType.FEE_PERCENTAGE).length || 0;
      const feeVoucherValue = campaign.vouchers.find((_) => _.type === VoucherType.FEE_PERCENTAGE)?.value || 0;
      const totalProductVoucher =
        campaign.vouchers.filter((_) => _.type === VoucherType.PRODUCT_PERCENTAGE).length || 0;
      const productVoucherValue = campaign.vouchers.find((_) => _.type === VoucherType.PRODUCT_PERCENTAGE)?.value || 0;

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

export default migrate;
