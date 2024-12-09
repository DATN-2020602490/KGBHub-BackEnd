import { BaseController } from "../../abstractions/base.controller";
import { File, KGBResponse, userSelector } from "../../global";
import { Attachment, Message, KGBRequest } from "../../global";
import NotFoundException from "../../exceptions/not-found";
import HttpException from "../../exceptions/http-exception";
import { createChat } from "./chat.service";
import { ChatMemberRole, MemberStatus, ConversationType, CourseStatus } from "@prisma/client";
import { fileMiddleware } from "../../middlewares/file.middleware";
import { KGBAuth } from "../../configs/passport";
export default class ChatController extends BaseController {
  public path = "/api/v1/chats";

  public initializeRoutes() {
    this.router.post("/", KGBAuth("jwt"), this.createChat);
    this.router.get("/", KGBAuth("jwt"), this.getChats);
    this.router.get("/:id", KGBAuth("jwt"), this.getChat);
    this.router.patch("/:id", KGBAuth("jwt"), this.updateChat);
    this.router.get("/message/:id", KGBAuth("jwt"), this.getMessage);
    this.router.post(
      "/actions/upload-attachments",
      KGBAuth("jwt"),
      fileMiddleware([{ name: "attachments", maxCount: 10 }]),
      this.uploadAttachments,
    );
    this.router.post("/actions/join", KGBAuth("jwt"), this.joinChat);
    this.router.post("/actions/leave", KGBAuth("jwt"), this.leaveChat);
    this.router.post("/actions/remove", KGBAuth("jwt"), this.removeChat);
    this.router.post("/actions/add-members", KGBAuth("jwt"), this.addMembers);
    this.router.post("/toggle/mute", KGBAuth("jwt"), this.toggleMute);
    this.router.get("/attachments/my-files", KGBAuth("jwt"), this.myFiles);
    this.router.get("/attachments/shared-files", KGBAuth("jwt"), this.sharedFiles);
  }
  getMessage = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const id = req.gp<string>("id", undefined, String);
    const message = await this.prisma.message.findFirst({
      where: {
        id,
        chatMembersOnMessages: { some: { chatMember: { userId: reqUser.id } } },
      },
      include: {
        chatMembersOnMessages: {
          include: {
            chatMember: {
              include: {
                user: userSelector,
              },
            },
          },
        },
        attachments: true,
        hearts: {
          include: {
            user: userSelector,
          },
        },
        targetMessage: true,
      },
    });
    return res.status(200).json(message);
  };
  sharedFiles = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const attachments = (
      (await this.prisma.attachment.findMany({
        where: {
          conversationId,
          conversation: { chatMembers: { some: { userId: reqUser.id } } },
        },
        take: limit,
        skip: offset,
      })) as Attachment[]
    ).filter((_) => _.messageId);
    return res.status(200).json(attachments);
  };

  myFiles = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const attachments = await this.prisma.attachment.findMany({
      where: { userId: reqUser.id, conversationId },
      take: limit,
      skip: offset,
    });
    return res.status(200).json(attachments);
  };
  toggleMute = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatMembers: { some: { userId: reqUser.id } },
      },
    });
    if (!conversation) {
      throw new NotFoundException("conversation", conversationId);
    }
    const chatMember = await this.prisma.chatMember.findFirst({
      where: { conversationId, userId: reqUser.id },
    });
    if (!chatMember) {
      throw new NotFoundException("chatMember", conversationId);
    }
    await this.prisma.chatMember.update({
      where: { id: chatMember.id },
      data: { isMute: !chatMember.isMute },
    });
    chatMember.isMute = !chatMember.isMute;
    res.status(200).json(chatMember);
    const chatMembers = await this.prisma.chatMember.findMany({
      where: { conversationId, status: MemberStatus.ACTIVE },
    });
    const sockets = await this.io.fetchSockets(chatMembers.map((_) => _.userId));
    for (const socket of sockets) {
      if (!socket.user) {
        continue;
      }
      await this.io.sendChatList(socket.user.id, conversation.id, socket);
    }
    // const sockets: any[] = await this.io.io.of(this.io.chatNamespaceRouter).fetchSockets()
    // for (const s of sockets) {
    //   if (!s.user) {
    //     continue
    //   }
    //   const isInRoom = await this.prisma.chatMember.findFirst({
    //     where: {
    //       userId: s.user.id,
    //       conversationId: conversation.id,
    //       status: MemberStatus.ACTIVE,
    //     },
    //   })
    //   if (isInRoom) {
    //     const chatList = await this.io.chatList(s.user.id)
    //     s.emit('getChats', chatList)
    //   }
    // }
  };

  addMembers = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatMembers: {
          some: { userId: reqUser.id, chatMemberRole: ChatMemberRole.ADMIN },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException("conversation", conversationId);
    }
    if (!req.body.users) {
      throw new HttpException(400, "users is required");
    }
    const users = req.body.users;
    const result = [];
    for (const u of users) {
      const { username, chatMemberRole } = u;
      const user = await this.prisma.user.findFirst({ where: { username } });
      if (!user) {
        continue;
      }
      const chatMember = await this.prisma.chatMember.findFirst({
        where: { conversationId, userId: user.id },
      });
      if (chatMember) {
        continue;
      }
      const c = await this.prisma.chatMember.create({
        data: {
          conversation: { connect: { id: conversationId } },
          user: { connect: { id: user.id } },
          status: MemberStatus.ACTIVE,
          chatMemberRole: chatMemberRole || ChatMemberRole.MEMBER,
        },
      });
      result.push(c);
    }
    res.status(200).json(result);
    const chatMembers = await this.prisma.chatMember.findMany({
      where: { conversationId, status: MemberStatus.ACTIVE },
    });
    const sockets = await this.io.fetchSockets(chatMembers.map((_) => _.userId));
    for (const socket of sockets) {
      if (!socket.user) {
        continue;
      }
      await this.io.sendChatList(socket.user.id, conversation.id, socket);
    }
    // const sockets: any[] = await this.io.io.of(this.io.chatNamespaceRouter).fetchSockets()
    // for (const s of sockets) {
    //   if (!s.user) {
    //     continue
    //   }
    //   const isInRoom = await this.prisma.chatMember.findFirst({
    //     where: {
    //       userId: s.user.id,
    //       conversationId: conversation.id,
    //       status: MemberStatus.ACTIVE,
    //     },
    //   })
    //   if (isInRoom) {
    //     const chatList = await this.io.chatList(s.user.id)
    //     s.emit('getChats', chatList)
    //   }
    // }
  };
  updateChat = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatMembers: {
          some: { userId: reqUser.id, chatMemberRole: ChatMemberRole.ADMIN },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException("conversation", conversationId);
    }
    const conversationName = req.body.conversationName;
    const avatar = req.body.avatarFileId;
    const cvs = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        conversationName: conversationName ?? conversation.conversationName,
        avatarFileId: avatar ?? conversation.avatarFileId,
      },
    });
    res.status(200).json(cvs);
    const chatMembers = await this.prisma.chatMember.findMany({
      where: { conversationId, status: MemberStatus.ACTIVE },
    });
    const sockets = await this.io.fetchSockets(chatMembers.map((_) => _.userId));
    for (const socket of sockets) {
      if (!socket.user) {
        continue;
      }
      await this.io.sendChatList(socket.user.id, conversation.id, socket);
    }
    // const sockets: any[] = await this.io.io.of(this.io.chatNamespaceRouter).fetchSockets()
    // for (const s of sockets) {
    //   if (!s.user) {
    //     continue
    //   }
    //   const isInRoom = await this.prisma.chatMember.findFirst({
    //     where: {
    //       userId: s.user.id,
    //       conversationId: conversation.id,
    //       status: MemberStatus.ACTIVE,
    //     },
    //   })
    //   if (isInRoom) {
    //     const chatList = await this.io.chatList(s.user.id)
    //     s.emit('getChats', chatList)
    //   }
    // }
  };
  removeChat = async (req: KGBRequest, res: KGBResponse) => {
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const username = req.gp<string>("username", undefined, String);
    const user = await this.prisma.user.findFirst({
      where: { username: username },
    });
    if (!user) {
      throw new NotFoundException("user", username);
    }
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatMembers: {
          some: { userId: req.user.id, chatMemberRole: ChatMemberRole.ADMIN },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException("conversation", conversationId);
    }
    const chatMember = await this.prisma.chatMember.findFirst({
      where: {
        conversationId,
        userId: user.id,
        chatMemberRole: ChatMemberRole.MEMBER,
      },
    });
    if (!chatMember) {
      throw new NotFoundException("chatMember", conversationId);
    }
    await this.prisma.chatMember.updateMany({
      where: { userId: user.id, conversationId: conversation.id },
      data: { status: MemberStatus.REMOVED },
    });
    res.status(200).json(chatMember);
    const chatMembers = await this.prisma.chatMember.findMany({
      where: { conversationId, status: MemberStatus.ACTIVE },
    });
    const sockets = await this.io.fetchSockets(chatMembers.map((_) => _.userId));
    for (const socket of sockets) {
      if (!socket.user) {
        continue;
      }
      await this.io.sendChatList(socket.user.id, conversation.id, socket);
    }
    // const sockets: any[] = await this.io.io.of(this.io.chatNamespaceRouter).fetchSockets()
    // for (const s of sockets) {
    //   if (!s.user) {
    //     continue
    //   }
    //   const isInRoom = await this.prisma.chatMember.findFirst({
    //     where: {
    //       userId: s.user.id,
    //       conversationId: conversation.id,
    //       status: MemberStatus.ACTIVE,
    //     },
    //   })
    //   if (isInRoom) {
    //     const chatList = await this.io.chatList(s.user.id)
    //     s.emit('getChats', chatList)
    //   }
    // }
  };
  leaveChat = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatMembers: { some: { userId: reqUser.id } },
      },
    });
    if (!conversation) {
      throw new NotFoundException("conversation", conversationId);
    }
    if (conversation.conversationType !== ConversationType.COURSE_GROUP_CHAT) {
      throw new HttpException(400, "You are not allowed to leave this conversation");
    }
    const chatMember = await this.prisma.chatMember.findFirst({
      where: { conversationId, userId: reqUser.id },
    });
    if (!chatMember) {
      throw new NotFoundException("chatMember", conversationId);
    }
    await this.prisma.chatMember.updateMany({
      where: { conversationId, userId: reqUser.id },
      data: { status: MemberStatus.REMOVED },
    });
    res.status(200).json(chatMember);
    const chatMembers = await this.prisma.chatMember.findMany({
      where: { conversationId, status: MemberStatus.ACTIVE },
    });
    const sockets = await this.io.fetchSockets(chatMembers.map((_) => _.userId));
    for (const socket of sockets) {
      if (!socket.user) {
        continue;
      }
      await this.io.sendChatList(socket.user.id, conversation.id, socket);
    }
    // const sockets: any[] = await this.io.io.of(this.io.chatNamespaceRouter).fetchSockets()
    // for (const s of sockets) {
    //   if (!s.user) {
    //     continue
    //   }
    //   const isInRoom = await this.prisma.chatMember.findFirst({
    //     where: {
    //       userId: s.user.id,
    //       conversationId: conversation.id,
    //       status: MemberStatus.ACTIVE,
    //     },
    //   })
    //   if (isInRoom) {
    //     const chatList = await this.io.chatList(s.user.id)
    //     s.emit('getChats', chatList)
    //   }
    // }
  };
  joinChat = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatMembers: { some: { userId: reqUser.id } },
      },
    });
    if (conversation) {
      throw new HttpException(400, "You are already a member of this conversation");
    }
    if (conversation.conversationType !== ConversationType.COURSE_GROUP_CHAT) {
      throw new HttpException(400, "You are not allowed to join this conversation");
    }
    const chatMember = await this.prisma.chatMember.create({
      data: {
        conversation: { connect: { id: conversationId } },
        user: { connect: { id: reqUser.id } },
        status: MemberStatus.ACTIVE,
        chatMemberRole: ChatMemberRole.MEMBER,
      },
    });
    res.status(200).json(chatMember);
    const chatMembers = await this.prisma.chatMember.findMany({
      where: { conversationId, status: MemberStatus.ACTIVE },
    });
    const sockets = await this.io.fetchSockets(chatMembers.map((_) => _.userId));
    for (const socket of sockets) {
      if (!socket.user) {
        continue;
      }
      await this.io.sendChatList(socket.user.id, conversation.id, socket);
    }
    // const sockets: any[] = await this.io.io.of(this.io.chatNamespaceRouter).fetchSockets()
    // for (const s of sockets) {
    //   if (!s.user) {
    //     continue
    //   }
    //   const isInRoom = await this.prisma.chatMember.findFirst({
    //     where: {
    //       userId: s.user.id,
    //       conversationId: conversation.id,
    //       status: MemberStatus.ACTIVE,
    //     },
    //   })
    //   if (isInRoom) {
    //     const chatList = await this.io.chatList(s.user.id)
    //     s.emit('getChats', chatList)
    //   }
    // }
  };
  createChat = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const conversation = await createChat(req.body, reqUser, this.io);
    return res.status(200).json(conversation);
  };
  getChats = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const chats = await this.prisma.conversation.findMany({
      where: {
        chatMembers: { some: { userId: reqUser.id } },
      },
      take: limit,
      skip: offset,
      include: {
        chatMembers: {
          include: {
            user: userSelector,
          },
        },
      },
    });
    const _ = [] as any[];
    for (const chat of chats) {
      if (chat.courseId) {
        if (
          !(await this.prisma.course.findFirst({
            where: { id: chat.courseId, status: CourseStatus.APPROVED },
          }))
        ) {
          continue;
        }
      }
      if (
        chat.chatMembers.find((_) => _.userId === reqUser.id && _.status === MemberStatus.PENDING)
      ) {
        _.push({
          conversation: { ...chat, unreadMessages: 0 },
          lastMessage: null,
        });
        continue;
      }
      const unreadMessages = await this.prisma.chatMembersOnMessages.count({
        where: {
          chatMember: { conversationId: chat.id, userId: reqUser.id },
          read: false,
        },
      });
      const lastMessage = (await this.prisma.message.findFirst({
        where: { conversationId: chat.id },
        orderBy: { createdAt: "desc" },
        include: {
          chatMembersOnMessages: {
            include: {
              chatMember: {
                include: {
                  user: userSelector,
                },
              },
            },
          },
        },
      })) as Message & { seenByAll: boolean };
      if (lastMessage) {
        lastMessage.seenByAll = lastMessage.chatMembersOnMessages.every((_) => _.read);
      }
      _.push({
        conversation: { ...chat, unreadMessages },
        lastMessage: lastMessage,
      });
    }
    const noLastMessage = _.filter((_) => !_.lastMessage);
    const hasLastMessage = _.filter((_) => _.lastMessage);
    const hasLastMessageSorted = hasLastMessage.sort((a, b) => {
      return (
        new Date(b.lastMessage.updatedAt).getTime() - new Date(a.lastMessage.updatedAt).getTime()
      );
    });
    return res.status(200).json([...hasLastMessageSorted, ...noLastMessage]);
  };
  getChat = async (req: KGBRequest, res: KGBResponse) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const reqUser = req.user;
    const id = req.gp<string>("id", undefined, String);
    const chat = await this.prisma.conversation.findFirst({
      where: {
        id,
        chatMembers: {
          some: { userId: reqUser.id, status: MemberStatus.ACTIVE },
        },
      },
      include: {
        chatMembers: {
          include: {
            user: userSelector,
          },
        },
      },
    });
    if (!chat) {
      throw new NotFoundException("chat", id);
    }
    const messages = await this.prisma.message.findMany({
      where: { conversationId: chat.id },
      take: limit,
      skip: offset,
      include: {
        chatMembersOnMessages: {
          include: {
            chatMember: {
              include: {
                user: userSelector,
              },
            },
          },
        },
        attachments: true,
        hearts: {
          include: {
            user: userSelector,
          },
        },
        targetMessage: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const mgses = await this.prisma.message.findMany({
      where: { conversationId: chat.id },
    });
    return res.status(200).json({ chat, messages, remaining: mgses.length > offset + limit });
  };
  uploadAttachments = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const attachments: File[] = req.fileModelsWithFieldName?.attachments;
    const conversationId = req.gp<string>("conversationId", undefined, String);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatMembers: {
          some: { userId: reqUser.id, status: MemberStatus.ACTIVE },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException("conversation", conversationId);
    }
    const _ = [] as any[];
    for (const attachment of attachments) {
      const __ = await this.prisma.attachment.create({
        data: {
          user: { connect: { id: reqUser.id } },
          fileId: attachment.id,
        },
      });
      _.push(__);
    }
    res.status(200).json(_);

    // const { attachments: attachmentList } = req.files as {
    //   attachments: Express.Multer.File[]
    // }
    // for (const _ of attachmentList) {
    //   try {
    //     unlinkSync(_.path)
    //   } catch (e) {
    //     console.log(e)
    //   }
    // }
  };
}
