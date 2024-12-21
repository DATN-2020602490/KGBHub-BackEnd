import { CampaignType } from "@prisma/client";
import prisma from "../../prisma";

export const autoJoinedProductCampaign = async (id: string) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id, type: CampaignType.DISCOUNT },
  });
  if (!campaign) {
    return;
  }
  const users = await prisma.user.findMany({});
  for (const user of users) {
    await prisma.campaignUser.create({
      data: {
        campaignId: campaign.id,
        userId: user.id,
      },
    });
  }
};
