import { ConversationType, ChatMemberRole, MemberStatus } from "@prisma/client";
import HttpException from "../../exceptions/http-exception";
import prisma from "../../prisma";
import IO from "../../socket/io";
import { KGBRemoteSocket, User } from "../../util/global";
import { getUniqueSuffix } from "../../util";
import { updateSearchAccent } from "../../prisma/prisma.service";

export const createChat = async (body: any, reqUser: User, io: IO) => {
  let { userIds } = body;

  userIds = validateRequest(userIds, reqUser.id);

  if (userIds.length === 1 && userIds[0] === reqUser.id) {
    return await handleCloudSaveConversation(userIds[0], io);
  }

  if (userIds.length === 2) {
    return await handleDirectMessageConversation(userIds, reqUser, io);
  }

  if (userIds.length > 2) {
    return await handleGroupChatConversation(userIds, reqUser, io);
  }

  throw new HttpException(400, "Invalid conversation type or userIds");
};

const validateRequest = (userIds: any, reqUserId?: string) => {
  if (!userIds || !Array.isArray(userIds)) {
    throw new HttpException(400, "userIds must be an array");
  }
  userIds = userIds.filter((id: string) => id !== reqUserId).concat(reqUserId);
  const data = [] as string[];
  for (const id of userIds) {
    if (data.includes(id)) {
      continue;
    }
    data.push(id);
  }
  return data;
};

export const handleCloudSaveConversation = async (userId: string, io?: IO) => {
  let conversation = await prisma.conversation.findFirst({
    where: {
      conversationType: ConversationType.CLOUD_SAVE,
      chatMembers: { some: { userId } },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        conversationName: "Cloud Save",
        conversationType: ConversationType.CLOUD_SAVE,
        roomId: `cloud_save_${userId}`,
        chatMembers: {
          create: {
            userId,
            chatMemberRole: ChatMemberRole.ADMIN,
            status: MemberStatus.ACTIVE,
          },
        },
      },
    });
  }
  await updateSearchAccent("conversation", conversation.id);
  if (io) {
    await notifyUsersInConversation(io, conversation.id);
  }
  return conversation;
};

const handleDirectMessageConversation = async (
  userIds: string[],
  reqUser: User,
  io: IO,
) => {
  const otherUserId = userIds.find((id) => id !== reqUser.id);

  const roomId = generateDMRoomId(reqUser.id, otherUserId);
  let conversation = await prisma.conversation.findFirst({
    where: { conversationType: ConversationType.DM, roomId },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        conversationType: ConversationType.DM,
        roomId,
        chatMembers: {
          createMany: {
            data: [
              {
                userId: reqUser.id,
                chatMemberRole: ChatMemberRole.ADMIN,
                status: MemberStatus.ACTIVE,
              },
              {
                userId: otherUserId,
                chatMemberRole: ChatMemberRole.ADMIN,
                status: MemberStatus.ACTIVE,
              },
            ],
          },
        },
      },
    });
    await updateSearchAccent("conversation", conversation.id);
  }

  await notifyUsersInConversation(io, conversation.id);
  return conversation;
};

const handleGroupChatConversation = async (
  userIds: string[],
  reqUser: User,
  io: IO,
) => {
  const existingConversation = await findExistingGroupConversation(
    userIds,
    reqUser.id,
  );
  if (existingConversation) return existingConversation;

  const uniqueSuffix = await getUniqueSuffix(
    "roomId",
    prisma.conversation,
    "group_chat_",
  );
  const conversation = await prisma.conversation.create({
    data: {
      conversationType: ConversationType.GROUP_CHAT,
      roomId: uniqueSuffix,
      chatMembers: {
        createMany: {
          data: userIds.map((userId) => ({
            userId,
            chatMemberRole:
              userId === reqUser.id
                ? ChatMemberRole.ADMIN
                : ChatMemberRole.MEMBER,
            status: MemberStatus.ACTIVE,
          })),
        },
      },
    },
  });

  await updateSearchAccent("conversation", conversation.id);
  await notifyUsersInConversation(io, conversation.id);
  return conversation;
};

const findExistingGroupConversation = async (
  userIds: string[],
  reqUserId: string,
) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      conversationType: ConversationType.GROUP_CHAT,
      chatMembers: { some: { userId: reqUserId } },
    },
    include: { chatMembers: true },
  });

  return conversations.find((conv) => {
    const memberIds = conv.chatMembers.map((m) => m.userId);
    return (
      userIds.length === memberIds.length &&
      userIds.every((id) => memberIds.includes(id))
    );
  });
};

const generateDMRoomId = (id1: string, id2: string) => {
  return id1 < id2 ? `dm_${id1}_${id2}` : `dm_${id2}_${id1}`;
};

const notifyUsersInConversation = async (io: IO, conversationId: string) => {
  const sockets = (await io.io
    .of(io.chatNamespaceRouter)
    .fetchSockets()) as KGBRemoteSocket[];
  for (const s of sockets) {
    if (!s.user) continue;
    const isInRoom = await prisma.chatMember.findFirst({
      where: { userId: s.user.id, conversationId, status: MemberStatus.ACTIVE },
    });
    if (isInRoom) {
      const chatList = await io.chatList(s.user.id);
      s.emit("getChats", chatList);
    }
  }
};
