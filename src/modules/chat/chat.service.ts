import { ConversationType, ChatMemberRole, MemberStatus } from "@prisma/client";
import HttpException from "../../exceptions/http-exception";
import prisma from "../../configs/prisma";
import IO from "../../socket/io";
import { User } from "../../global";
import { getUniqueSuffix } from "../../util";

export const createChat = async (body: any, reqUser: User, io: IO) => {
  const conversationType = body.conversationType as ConversationType;
  if (
    !conversationType ||
    conversationType === ConversationType.DM ||
    conversationType === ConversationType.CLOUD_SAVE ||
    conversationType === ConversationType.GROUP_CHAT
  ) {
    const { userIds } = body;
    if (!userIds) {
      throw new HttpException(400, "userIds is required");
    }
    if (!Array.isArray(userIds)) {
      throw new HttpException(400, "userIds must be an array");
    }
    if (!userIds.includes(reqUser.id)) {
      throw new HttpException(403, "Missing user id in userIds array");
    }
    if (userIds.length === 2) {
      if (userIds[0] === userIds[1]) {
        const userId = userIds[0];
        const existConversation = await prisma.conversation.findFirst({
          where: {
            conversationType: ConversationType.CLOUD_SAVE,
            chatMembers: { some: { userId: userId } },
          },
        });
        if (existConversation) {
          return existConversation;
        }
        const conversation = await prisma.conversation.create({
          data: {
            conversationType: ConversationType.CLOUD_SAVE,
            roomId: `cloud_save_${userId}`,
            chatMembers: {
              create: {
                userId: userId,
                chatMemberRole: ChatMemberRole.ADMIN,
                status: MemberStatus.ACTIVE,
              },
            },
          },
        });
        const sockets: any[] = await io.io
          .of(io.chatNamespaceRouter)
          .fetchSockets();
        for (const s of sockets) {
          if (!s.user) {
            continue;
          }
          const isInRoom = await prisma.chatMember.findFirst({
            where: {
              userId: s.user.id,
              conversationId: conversation.id,
              status: MemberStatus.ACTIVE,
            },
          });
          if (isInRoom) {
            const chatList = await io.chatList(s.user.id);
            s.emit("getChats", chatList);
          }
        }
        return conversation;
      }
      const userId = userIds.find((_) => _ !== reqUser.id);
      const existConversation = await prisma.conversation.findFirst({
        where: {
          conversationType: ConversationType.DM,
          chatMembers: {},
          roomId:
            reqUser.id < userId
              ? `dm_${reqUser.id}_${userId}`
              : `dm_${userId}_${reqUser.id}`,
        },
      });
      if (existConversation) {
        return existConversation;
      }
      const conversation = await prisma.conversation.create({
        data: {
          conversationType: ConversationType.DM,
          roomId:
            reqUser.id < userId
              ? `dm_${reqUser.id}_${userId}`
              : `dm_${userId}_${reqUser.id}`,
          chatMembers: {
            createMany: {
              data: [
                {
                  userId: reqUser.id,
                  chatMemberRole: ChatMemberRole.ADMIN,
                  status: MemberStatus.ACTIVE,
                },
                {
                  userId: userId,
                  chatMemberRole: ChatMemberRole.ADMIN,
                  status: MemberStatus.ACTIVE,
                },
              ],
            },
          },
        },
      });
      const sockets: any[] = await io.io
        .of(io.chatNamespaceRouter)
        .fetchSockets();
      for (const s of sockets) {
        if (!s.user) {
          continue;
        }
        const isInRoom = await prisma.chatMember.findFirst({
          where: {
            userId: s.user.id,
            conversationId: conversation.id,
            status: MemberStatus.ACTIVE,
          },
        });
        if (isInRoom) {
          const chatList = await io.chatList(s.user.id);
          s.emit("getChats", chatList);
        }
      }
      return conversation;
    } else if (userIds.length > 2) {
      const existConversations = await prisma.conversation.findMany({
        where: {
          conversationType: ConversationType.GROUP_CHAT,
          chatMembers: { some: { userId: reqUser.id } },
        },
      });
      for (const conversation of existConversations) {
        const members = await prisma.chatMember.findMany({
          where: {
            conversationId: conversation.id,
            status: MemberStatus.ACTIVE,
          },
        });
        if (members.length === userIds.length) {
          const existUserIds = members.map((_) => _.userId);
          if (userIds.every((_) => existUserIds.includes(_))) {
            return conversation;
          }
        }
      }
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
              data: userIds.map((userId) => {
                if (userId === reqUser.id) {
                  return {
                    userId: userId,
                    chatMemberRole: ChatMemberRole.ADMIN,
                    status: MemberStatus.ACTIVE,
                  };
                }
                return {
                  userId: userId,
                  chatMemberRole: ChatMemberRole.MEMBER,
                  status: MemberStatus.ACTIVE,
                };
              }),
            },
          },
        },
      });
      const sockets: any[] = await io.io
        .of(io.chatNamespaceRouter)
        .fetchSockets();
      for (const s of sockets) {
        if (!s.user) {
          continue;
        }
        const isInRoom = await prisma.chatMember.findFirst({
          where: {
            userId: s.user.id,
            conversationId: conversation.id,
            status: MemberStatus.ACTIVE,
          },
        });
        if (isInRoom) {
          const chatList = await io.chatList(s.user.id);
          s.emit("getChats", chatList);
        }
      }
      return conversation;
    }
  }
};
