import { BaseController } from "../../abstractions/base.controller";
import {
  CampaignUser,
  File,
  KGBRequest,
  KGBResponse,
  userSelector,
} from "../../global";
import { checkRole } from "../auth/auth.service";
import { CampaignType, RoleEnum, VoucherType } from "@prisma/client";
import { fileMiddleware } from "../../middlewares/file.middleware";
import { getUniqueSuffix } from "../../util";
import checkRoleMiddleware from "../../middlewares/checkRole.middleware";
import NotFoundException from "../../exceptions/not-found";
import { isString } from "lodash";
import { KGBAuth } from "../../configs/passport";
import { removeAccent, updateSearchAccent } from "../../util/searchAccent";
import { autoJoinedProductCampaign } from "./campaign.service";

export default class CampaignController extends BaseController {
  public path = "/api/v1/campaigns";

  public initializeRoutes() {
    this.router.get("/", KGBAuth(["jwt", "anonymous"]), this.getCampaigns);
    this.router.get("/:id", KGBAuth(["jwt", "anonymous"]), this.getCampaign);
    this.router.post(
      "/",
      KGBAuth(["jwt", "anonymous"]),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      fileMiddleware([{ name: "cover", maxCount: 1 }]),
      this.createCampaign,
    );
    this.router.patch(
      "/:id",
      KGBAuth(["jwt", "anonymous"]),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      fileMiddleware([{ name: "cover", maxCount: 1 }]),
      this.updateCampaign,
    );
    this.router.delete(
      "/:id",
      KGBAuth(["jwt", "anonymous"]),
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
    const limit = req.gp<number>("limit", 12, Number);
    const offset = req.gp<number>("offset", 0, Number);
    const orderBy = req.gp<string>("orderBy", "createdAt", String);
    const order = req.gp<string>("direction", "desc", ["asc", "desc"]);
    const search = req.gp<string>("search", null, String);
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
      return res
        .status(200)
        .json(campaigns.filter((_) => _.active).slice(offset, offset + limit));
    }
    return res.status(200).json(campaigns.slice(offset, offset + limit));
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
      return res.status(404).json({ message: "Campaign not found" });
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
        return res.status(404).json({ message: "Campaign not found" });
      }
    }
    return res.status(200).json(campaign);
  };

  createCampaign = async (req: KGBRequest, res: KGBResponse) => {
    const name = req.gp<string>("name", undefined, String);
    const description = req.gp<string>("description", undefined, String);
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
    res.status(201).json(campaign);
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
    const name = req.gp<string>("name", campaign.name, String);
    const description = req.gp<string>(
      "description",
      campaign.description,
      String,
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
    await updateSearchAccent("campaign", _.id);
    return res.status(200).json(_);
  };

  deleteCampaign = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const campaign = await this.prisma.campaign.findFirst({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("campaign", id);
    }
    await this.prisma.campaign.delete({ where: { id } });
    return res.status(204).json();
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
      return res.status(404).json({ message: "Campaign not active" });
    }
    const user = req.user;
    const campaignUser = await this.prisma.campaignUser.findFirst({
      where: { campaignId, userId: user.id },
    });
    if (campaignUser) {
      return res.status(200).json(campaignUser);
    }
    if (campaign.type === CampaignType.VOUCHERS) {
      if (campaign.totalVoucher === 0) {
        return res.status(404).json({ message: "No voucher left" });
      }
      if (campaign.campaignUsers.length >= campaign.totalVoucher) {
        return res.status(404).json({ message: "No voucher left" });
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
        return res.status(404).json({ message: "No voucher left" });
      }
      const _ = await this.prisma.campaignUser.create({
        data: {
          campaignId,
          userId: user.id,
          vouchers: { connect: { id: remainingVoucher.id } },
        },
      });
      res.status(200).json(_);
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
      res.status(200).json(campaignUser);
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
      where: { userId: user.id },
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
    return res.status(200).json(campaignUsers);
  };
}
