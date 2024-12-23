import { render } from "@react-email/render";
import prisma from "../prisma";
import {
  Campaign,
  QUEUE_NAMES,
  REDIS_HOST,
  REDIS_PORT,
  userSelector,
} from "../util/global";
import CampaignEndingEmail from "../email/templates/campaign.ending";
import sendEmail from "../email/process";
import Queue from "bull";
import { scheduleJob, queues } from "./bull.service";

export const processSendEmailCampaign = async (data: { id: string }) => {
  const { id } = data;
  const campaign = (await prisma.campaign.findFirst({
    where: { id },
    include: { campaignUsers: { include: { user: userSelector } } },
  })) as Campaign;
  if (!campaign) {
    return;
  }
  for (const campaignUser of campaign.campaignUsers) {
    const html = render(
      CampaignEndingEmail({
        userFirstName: campaignUser.user.firstName,
        userLastName: campaignUser.user.lastName,
        campaign: campaign,
      }),
    );
    await sendEmail(html, campaignUser.user.email, "Your campaign is ending");
  }
};

export const deactivateCampaign = async (data: { id: string }) => {
  const { id } = data;
  const campaign = await prisma.campaign.findFirst({ where: { id } });
  if (!campaign) {
    return;
  }

  await prisma.campaign.update({
    where: { id },
    data: { active: false },
  });
};

export const scheduleCampaign = async (data: { id: string }) => {
  const campaign = await prisma.campaign.findFirst({ where: { id: data.id } });
  if (!campaign) {
    return;
  }
  const oneDayLeftTime = campaign.endAt.getTime() - 24 * 60 * 60 * 1000;
  if (oneDayLeftTime > Date.now()) {
    const oneDayLeft = new Date(oneDayLeftTime);
    scheduleJob(QUEUE_NAMES.sendEmailCampaign, oneDayLeft, data);
  } else {
    scheduleJob(
      QUEUE_NAMES.sendEmailCampaign,
      new Date(Date.now() + 60 * 1000),
      data,
    );
  }
  scheduleJob(QUEUE_NAMES.deactivateCampaign, campaign.endAt, data);
};

export const removeCampaignJob = async (data: { id: string }) => {
  const campaign = await prisma.campaign.findFirst({ where: { id: data.id } });
  if (!campaign) {
    return;
  }
  const jobList1 = await queues[QUEUE_NAMES.sendEmailCampaign].getJobs([
    "waiting",
  ]);
  for (const job of jobList1) {
    if (job.data.id === campaign.id) {
      await job.remove();
    }
  }
  const jobList2 = await queues[QUEUE_NAMES.deactivateCampaign].getJobs([
    "waiting",
  ]);
  for (const job of jobList2) {
    if (job.data.id === campaign.id) {
      await job.remove();
    }
  }
};

export const init = () => {
  queues[QUEUE_NAMES.sendEmailCampaign] = new Queue(
    QUEUE_NAMES.sendEmailCampaign,
    {
      redis: { host: REDIS_HOST, port: REDIS_PORT },
    },
  );
  queues[QUEUE_NAMES.deactivateCampaign] = new Queue(
    QUEUE_NAMES.deactivateCampaign,
    {
      redis: { host: REDIS_HOST, port: REDIS_PORT },
    },
  );
  queues[QUEUE_NAMES.sendEmailCampaign].process(async (job) => {
    await processSendEmailCampaign(job.data);
  });

  queues[QUEUE_NAMES.deactivateCampaign].process(async (job) => {
    await deactivateCampaign(job.data);
  });
};
