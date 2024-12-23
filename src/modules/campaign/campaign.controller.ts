import { BaseController } from "../../abstractions/base.controller";
import {
  CampaignUser,
  File,
  KGBRequest,
  KGBResponse,
  limitDefault,
  offsetDefault,
  userSelector,
} from "../../util/global";
import { checkRole } from "../auth/auth.service";
import { CampaignType, RoleEnum, VoucherType } from "@prisma/client";
import { fileMiddleware } from "../../middlewares/file.middleware";
import { checkBadWord, getUniqueSuffix } from "../../util";
import checkRoleMiddleware from "../../middlewares/checkRole.middleware";
import NotFoundException from "../../exceptions/not-found";
import { isString } from "lodash";
import { KGBAuth } from "../../configs/passport";
import { removeAccent, updateSearchAccent } from "../../prisma/prisma.service";
import { autoJoinedProductCampaign } from "./campaign.service";
import {
  removeCampaignJob,
  scheduleCampaign,
} from "../../bull/campaign.service";

export default class CampaignController extends BaseController {
  public path = "/api/v1/campaigns";

  public initializeRoutes() {
    this.router.get("/", KGBAuth(["jwt", "anonymous"]), this.getCampaigns);
    this.router.get("/:id", KGBAuth(["jwt", "anonymous"]), this.getCampaign);
    this.router.post(
      "/",
      KGBAuth(["jwt"]),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      fileMiddleware([{ name: "cover", maxCount: 1 }]),
      this.createCampaign,
    );
    this.router.patch(
      "/:id",
      KGBAuth(["jwt"]),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      fileMiddleware([{ name: "cover", maxCount: 1 }]),
      this.updateCampaign,
    );
    this.router.delete(
      "/:id",
      KGBAuth(["jwt"]),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      this.deleteCampaign,
    );
    this.router.post(
      "/actions/join-campaign",
      KGBAuth(["jwt"]),
      this.joinCampaign,
    );
    this.router.get(
      "/actions/my-promotion",
      KGBAuth(["jwt"]),
      this.getMyPromotion,
    );
  }

  getCampaigns = async (req: KGBRequest, res: KGBResponse) => {
    const limit = req.gp<number>("limit", limitDefault, Number);
    const offset = req.gp<number>("offset", offsetDefault, Number);
    const orderBy = req.gp<string>("orderBy", "createdAt", String);
    const order = req.gp<string>("direction", "desc", ["asc", "desc"]);
    const search = req.gp<string>("search", null, checkBadWord);
    const type = req.gp<CampaignType>("type", null, CampaignType);
    const where = {};
    if (search) {
      where["searchAccent"] = { contains: removeAccent(search) };
    }
    if (type) {
      where["type"] = type;
    }
    const campaigns = await this.prisma.campaign.findMany({
      where,
      orderBy: { [orderBy]: order },
    });
    if (req.user) {
      for (const campaign of campaigns) {
        const campaignUser = await this.prisma.campaignUser.findFirst({
          where: { campaignId: campaign.id, userId: req.user.id },
        });
        if (campaignUser) {
          campaign["isJoined"] = true;
        }
      }
    }
    if (!req.user || !checkRole(req.user, [RoleEnum.ADMIN])) {
      const total = campaigns.filter((_) => _.active).length;
      return res
        .status(200)
        .data(
          campaigns.filter((_) => _.active).slice(offset, offset + limit),
          total,
        );
    }
    const total = campaigns.length;
    return res.status(200).data(campaigns.slice(offset, offset + limit), total);
  };

  getCampaign = async (req: KGBRequest, res: KGBResponse) => {
    const campaignId = req.gp<string>("id", undefined, String);
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId },
      include: {
        campaignUsers: {
          include: {
            user: userSelector,
          },
        },
        vouchers: true,
      },
    });
    if (!campaign) {
      return res.status(404).data({ message: "Campaign not found" });
    }
    if (req.user) {
      const campaignUser = await this.prisma.campaignUser.findFirst({
        where: { campaignId: campaign.id, userId: req.user.id },
      });
      if (campaignUser) {
        campaign["isJoined"] = true;
      }
    }
    if (!req.user || !checkRole(req.user, [RoleEnum.ADMIN])) {
      if (!campaign.active) {
        return res.status(404).data({ message: "Campaign not found" });
      }
    }
    return res.status(200).data(campaign);
  };

  createCampaign = async (req: KGBRequest, res: KGBResponse) => {
    const name = req.gp<string>("name", undefined, checkBadWord);
    const description = req.gp<string>("description", undefined, checkBadWord);
    const startAt = new Date(
      req.gp<string | Date>("startAt", undefined, String),
    );
    const endAt = new Date(req.gp<string | Date>("endAt", undefined, String));
    const type = req.gp<CampaignType>(
      "type",
      CampaignType.VOUCHERS,
      CampaignType,
    );
    let cover: File = null;
    const coverFile = req.fileModelsWithFieldName?.cover
      ? req.fileModelsWithFieldName?.cover.length === 1
        ? (req.fileModelsWithFieldName?.cover)[0]
        : null
      : null;
    if (coverFile) {
      cover = coverFile;
    } else if (req.body.coverFileId) {
      cover = { id: req.body.coverFileId } as File;
    } else {
      throw new Error("Cover is required");
    }
    const campaign = await this.prisma.campaign.create({
      data: {
        name,
        description,
        startAt,
        endAt,
        coverFileId: cover.id,
        totalVoucher: 0,
        totalUsed: 0,
        type,
      },
    });
    res.status(201).data(campaign);
    await scheduleCampaign({ id: campaign.id });
    await updateSearchAccent("campaign", campaign.id);
    if (type === CampaignType.VOUCHERS) {
      const totalFeeVoucher = req.gp<number>("totalFeeVoucher", 0, Number);
      const feeVoucherValue = req.gp<number>("feeVoucherValue", 20, Number);
      const totalProductVoucher = req.gp<number>(
        "totalProductVoucher",
        0,
        Number,
      );
      const productVoucherValue = req.gp<number>(
        "productVoucherValue",
        20,
        Number,
      );
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          totalFeeVoucher,
          feeVoucherValue,
          totalProductVoucher,
          productVoucherValue,
        },
      });
      for (let i = 0; i < totalFeeVoucher; i++) {
        const voucherCode = await getUniqueSuffix(
          "code",
          this.prisma.voucher,
          "fee_",
        );
        await this.prisma.voucher.create({
          data: {
            code: voucherCode,
            type: VoucherType.FEE_PERCENTAGE,
            campaignId: campaign.id,
            value: feeVoucherValue,
          },
        });
      }
      for (let i = 0; i < totalProductVoucher; i++) {
        const voucherCode = await getUniqueSuffix(
          "code",
          this.prisma.voucher,
          "product_",
        );
        await this.prisma.voucher.create({
          data: {
            code: voucherCode,
            type: VoucherType.PRODUCT_PERCENTAGE,
            campaignId: campaign.id,
            value: productVoucherValue,
          },
        });
      }
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          totalVoucher: totalFeeVoucher + totalProductVoucher,
        },
      });
    } else {
      const requireJoined =
        req.gp<string>("requireJoined", "true", String) === "true";

      let courseIds = req.gp<{ id: string; discount: number }[] | string>(
        "courseIds",
        "[]",
        JSON.parse,
      );
      if (isString(courseIds)) {
        courseIds = JSON.parse(courseIds) as { id: string; discount: number }[];
      }
      if (courseIds.length) {
        let min = courseIds[0].discount;
        let max = courseIds[0].discount;
        for (const courseId of courseIds) {
          if (courseId.discount < min) {
            min = courseId.discount;
          }
          if (courseId.discount > max) {
            max = courseId.discount;
          }
          await this.prisma.campaignDiscount.create({
            data: {
              campaignId: campaign.id,
              courseId: courseId.id,
              value: courseId.discount,
            },
          });
        }
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            discountFrom: min,
            discountTo: max,
          },
        });
      }
      if (!requireJoined) {
        await autoJoinedProductCampaign(campaign.id);
      }
    }
  };

  updateCampaign = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const campaign = await this.prisma.campaign.findFirst({
      where: { id },
      include: { vouchers: true },
    });
    if (!campaign) {
      throw new NotFoundException("campaign", id);
    }
    const name = req.gp<string>("name", campaign.name, checkBadWord);
    const description = req.gp<string>(
      "description",
      campaign.description,
      checkBadWord,
    );
    const startAt = new Date(
      req.gp<string | Date>("startAt", campaign.startAt, String),
    );
    const endAt = new Date(
      req.gp<string | Date>("endAt", campaign.endAt, String),
    );
    let cover: File = null;
    const coverFile = req.fileModelsWithFieldName?.cover
      ? req.fileModelsWithFieldName?.cover.length === 1
        ? (req.fileModelsWithFieldName?.cover)[0]
        : null
      : null;
    if (coverFile) {
      cover = (req.fileModelsWithFieldName?.cover)[0];
    } else if (req.body.coverFileId) {
      cover = { id: req.body.coverFileId } as File;
    } else {
      cover = { id: campaign.coverFileId } as File;
    }

    const _ = await this.prisma.campaign.update({
      where: { id },
      data: {
        name,
        description,
        startAt,
        endAt,
        coverFileId: cover.id,
      },
    });
    res.status(200).data(_);
    if (endAt > campaign.endAt && !campaign.active) {
      await this.prisma.campaign.update({
        where: {
          id,
        },
        data: { active: true },
      });
    }
    await updateSearchAccent("campaign", _.id);
    await removeCampaignJob({ id: _.id });
    await scheduleCampaign({ id: _.id });
  };

  deleteCampaign = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const campaign = await this.prisma.campaign.findFirst({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("campaign", id);
    }
    await this.prisma.campaignUser.deleteMany({ where: { campaignId: id } });
    await this.prisma.voucher.deleteMany({ where: { campaignId: id } });
    await this.prisma.campaignDiscount.deleteMany({
      where: { campaignId: id },
    });
    await this.prisma.campaign.delete({ where: { id } });
    res.status(200).data(campaign);
    await removeCampaignJob({ id: campaign.id });
  };

  joinCampaign = async (req: KGBRequest, res: KGBResponse) => {
    const campaignId = req.gp<string>("campaignId", undefined, String);

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId },
      include: { campaignUsers: true },
    });

    if (!campaign) {
      throw new NotFoundException("campaign", campaignId);
    }
    if (campaign.startAt > new Date() || campaign.endAt < new Date()) {
      return res.status(404).data({ message: "Campaign not active" });
    }
    const user = req.user;
    const campaignUser = await this.prisma.campaignUser.findFirst({
      where: { campaignId, userId: user.id },
    });
    if (campaignUser) {
      return res.status(200).data(campaignUser);
    }
    if (campaign.type === CampaignType.VOUCHERS) {
      if (campaign.totalVoucher === 0) {
        return res.status(404).data({ message: "No voucher left" });
      }
      if (campaign.campaignUsers.length >= campaign.totalVoucher) {
        return res.status(404).data({ message: "No voucher left" });
      }
      const randomVoucherType =
        Math.random() > 0.5
          ? VoucherType.FEE_PERCENTAGE
          : VoucherType.PRODUCT_PERCENTAGE;
      let remainingVoucher = await this.prisma.voucher.findFirst({
        where: { campaignId, type: randomVoucherType, campaignUserId: null },
      });
      if (!remainingVoucher) {
        remainingVoucher = await this.prisma.voucher.findFirst({
          where: {
            campaignId,
            type:
              randomVoucherType === VoucherType.FEE_PERCENTAGE
                ? VoucherType.PRODUCT_PERCENTAGE
                : VoucherType.FEE_PERCENTAGE,
            campaignUserId: null,
          },
        });
      }
      if (!remainingVoucher) {
        return res.status(404).data({ message: "No voucher left" });
      }
      const _ = await this.prisma.campaignUser.create({
        data: {
          campaignId,
          userId: user.id,
          vouchers: { connect: { id: remainingVoucher.id } },
        },
      });
      res.status(200).data(_);
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          totalUsed: campaign.totalUsed + 1,
        },
      });
    } else {
      const campaignUser = await this.prisma.campaignUser.create({
        data: {
          campaignId,
          userId: user.id,
        },
      });
      res.status(200).data(campaignUser);
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          totalUsed: campaign.totalUsed + 1,
        },
      });
    }
  };

  getMyPromotion = async (req: KGBRequest, res: KGBResponse) => {
    const courseId = req.gp<string>("courseId", null, String);
    const user = req.user;

    const campaignUsers = (await this.prisma.campaignUser.findMany({
      where: {
        userId: user.id,
        campaign: {
          startAt: { lte: new Date() },
          endAt: { gte: new Date() },
          active: true,
        },
      },
      include: {
        campaign: {
          include: {
            campaignDiscounts: courseId
              ? {
                  where: {
                    courseId,
                  },
                }
              : true,
          },
        },
        vouchers: {
          where: {
            isUsed: false,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })) as CampaignUser[];
    return res.status(200).data(campaignUsers);
  };
}
