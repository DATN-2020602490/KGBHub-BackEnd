import { Server } from "http";
import { JwtPayload, verify } from "jsonwebtoken";
import { Namespace, Server as SocketServer } from "socket.io";
import {
  ChatMembersOnMessages,
  Message,
  KGBSocket,
  User,
  ConversationWithLastMessage,
  KGBRemoteSocket,
  userSelector,
  limitDefault,
  offsetDefault,
} from "../util/global";
import { CourseStatus, MemberStatus, UserView } from "@prisma/client";
import prisma from "../prisma";
import { updateSearchAccent } from "../prisma/prisma.service";
import { censorProfane } from "../util";

class IO {
  public io: SocketServer;
  private prisma = prisma;
  public chatNamespaceRouter = "/chats";
  public notificationNamespaceRouter = "/notifications";
  public chatNamespace: Namespace;
  public notificationNamespace: Namespace;
  public userHistoryInRooms: { [key: string]: string[] } = {};

  constructor(server: Server) {
    this.io = new SocketServer(server);
    this.setupSocketIO();
  }

  fetchSockets = async (
    userIds: string[],
    namespace = this.chatNamespaceRouter,
  ): Promise<KGBRemoteSocket[]> => {
    const sockets = (await this.io
      .of(namespace)
      .fetchSockets()) as KGBRemoteSocket[];
    if (userIds.length === 0 || !sockets) {
      return sockets;
    }
    return sockets
      .filter((_) => !!_.user)
      .filter((socket) => userIds.includes(socket.user.id));
  };

  makeRead = async (
    userId: string,
    roomId: string,
    socket: KGBRemoteSocket | KGBSocket,
  ) => {
    if (socket) {
      if (socket.rooms.has(roomId)) {
        await prisma.chatMembersOnMessages.updateMany({
          where: {
            chatMember: { userId, conversation: { roomId } },
          },
          data: { read: true, readAt: new Date(), forceRead: true },
        });
      }
      return;
    }
    const sockets = await this.fetchSockets([userId]);
    for (const socket of sockets) {
      if (socket.rooms.has(roomId)) {
        await prisma.chatMembersOnMessages.updateMany({
          where: {
            chatMember: { userId, conversation: { roomId } },
          },
          data: { read: true, readAt: new Date(), forceRead: true },
        });
      }
    }
  };

  sendChatList = async (
    userId: string,
    conversationId: string,
    socket?: KGBRemoteSocket | KGBSocket,
  ) => {
    if (socket) {
      if (!socket.user) {
        return;
      }
      const isInRoom = await prisma.chatMember.findFirst({
        where: {
          userId,
          conversationId,
          status: MemberStatus.ACTIVE,
        },
      });
      if (isInRoom) {
        const chatList = await this.chatList(userId);
        socket.emit("getChats", chatList);
      }
      return;
    }
    const sockets = await this.fetchSockets([userId]);
    for (const socket of sockets) {
      if (!socket.user) {
        continue;
      }
      const isInRoom = await prisma.chatMember.findFirst({
        where: {
          userId,
          conversationId,
          status: MemberStatus.ACTIVE,
        },
      });
      if (isInRoom) {
        const chatList = await this.chatList(userId);
        socket.emit("getChats", chatList);
      }
    }
  };

  public async getMessage(id: string, socket: KGBSocket) {
    const message = (await this.prisma.message.findFirst({
      where: { id },
      include: {
        targetMessage: true,
        attachments: true,
        hearts: {
          include: {
            user: userSelector,
          },
        },
      },
    })) as Message;
    const usersOnMessages = (await this.prisma.chatMembersOnMessages.findMany({
      where: { chatMember: { userId: socket.user.id }, message: { id } },
      include: {
        chatMember: {
          include: {
            user: userSelector,
          },
        },
      },
    })) as ChatMembersOnMessages[];
    message.chatMembersOnMessages = usersOnMessages;
    return message;
  }

  private setupLogin = (socket: KGBSocket, message = false) => {
    socket.on("login", async (data: { accessToken: string }) => {
      try {
        const accessToken = data.accessToken;
        if (!accessToken) {
          socket.emit("login", { error: "Access token not found" });
          return;
        }
        const reqUser = (
          verify(accessToken, process.env.SECRET as string) as JwtPayload
        ).user as User;

        const user = (await this.prisma.user.findFirst({
          where: { email: reqUser.email },
          include: { roles: { include: { role: true } } },
        })) as User;

        if (!user) {
          socket.emit("login", { error: "User not found" });
          return;
        }
        socket.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
        } as User;

        if (message) {
          const result = await this.chatList(socket.user.id);
          socket.emit("getChats", result);
        }
        socket.emit("login", {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles,
          },
        });
      } catch (e: any) {
        console.log(e);
        socket.emit("login", { error: e.message });
      }
    });
  };

  public chatList = async (
    userId: string,
  ): Promise<ConversationWithLastMessage[]> => {
    let chats = await this.prisma.conversation.findMany({
      where: {
        chatMembers: {
          some: { userId, status: MemberStatus.ACTIVE },
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
    chats = await Promise.all(
      chats.filter(async (chat) => {
        if (chat.courseId) {
          const course = await this.prisma.course.findFirst({
            where: { id: chat.courseId, status: CourseStatus.APPROVED },
          });
          if (!course) {
            return false;
          }
        }
        return true;
      }),
    );
    const _ = [] as any[];
    for (const chat of chats) {
      const unreadMessages = await this.prisma.chatMembersOnMessages.count({
        where: {
          chatMember: { conversationId: chat.id, userId },
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
        lastMessage.seenByAll = lastMessage.chatMembersOnMessages.every(
          (_) => _.read,
        );
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
        new Date(b.lastMessage.updatedAt).getTime() -
        new Date(a.lastMessage.updatedAt).getTime()
      );
    });

    return [...hasLastMessageSorted, ...noLastMessage];
  };

  private setupChat = (socket: KGBSocket) => {
    socket.on("getChats", async () => {
      try {
        if (!socket.user) {
          socket.emit("getChats", { error: "Access denied" });
          return;
        }
        const reqUser = socket.user;
        const result = await this.chatList(reqUser.id);
        socket.emit("getChats", result);
      } catch (e: any) {
        socket.emit("getChats", { error: e.message });
      }
    });

    socket.on(
      "getChat",
      async (data: {
        id: string | string;
        limit: number | string;
        offset: number | string;
      }) => {
        try {
          if (!socket.user) {
            socket.emit("getChat", { error: "Access denied" });
            return;
          }
          const limit = parseInt(String(data.limit)) || limitDefault;
          const offset = parseInt(String(data.offset)) || offsetDefault;
          const reqUser = socket.user as User;
          if (!data.id) {
            throw new Error("Invalid id");
          }
          const id = String(data.id);
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
            socket.emit("getChat", { error: "Conversation not found" });
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
          const result = {
            chat,
            messages,
            remaining: mgses.length > offset + limit,
          };
          socket.emit("getChat", result);
        } catch (e: any) {
          socket.emit("getChat", { error: e.message });
        }
      },
    );

    socket.on("joinRoom", async (data: { id: string }) => {
      try {
        if (!socket.user?.id) {
          socket.emit("joinRoom", { error: "Access denied" });
          return;
        }
        const { id } = data;
        const conversation = await this.prisma.conversation.findFirst({
          where: { roomId: id },
        });
        if (!conversation) {
          socket.emit("joinRoom", { error: "Conversation not found" });
          return;
        }
        const chatMember = await this.prisma.chatMember.findFirst({
          where: { conversationId: conversation.id, userId: socket.user.id },
        });
        if (!chatMember) {
          socket.emit("joinRoom", { error: "Access denied" });
          return;
        }
        await this.prisma.chatMembersOnMessages.updateMany({
          where: {
            message: { conversationId: conversation.id },
            chatMember: { userId: socket.user.id, status: MemberStatus.ACTIVE },
            read: false,
          },
          data: { read: true, readAt: new Date(), forceRead: true },
        });
        socket.join(conversation.roomId);
        socket.emit("joinRoom", { success: true });
        const result = await this.chatList(socket.user.id);
        socket.emit("getChats", result);
      } catch (e: any) {
        socket.emit("joinRoom", { error: e.message });
      }
    });

    socket.on("outRoom", async (data: { id: string }) => {
      try {
        if (!socket.user?.id) {
          socket.emit("outRoom", { error: "Access denied" });
          return;
        }
        const { id } = data;
        const conversation = await this.prisma.conversation.findFirst({
          where: { roomId: id },
        });
        if (!conversation) {
          socket.emit("outRoom", { error: "Conversation not found" });
          return;
        }
        const chatMember = await this.prisma.chatMember.findFirst({
          where: { conversationId: conversation.id, userId: socket.user.id },
        });
        if (!chatMember) {
          socket.emit("outRoom", { error: "Access denied" });
          return;
        }
        socket.rooms.forEach((room) => {
          if (room === conversation.roomId) {
            socket.leave(room);
          }
        });
        socket.emit("outRoom", { success: true });
      } catch (e: any) {
        socket.emit("outRoom", { error: e.message });
      }
    });

    socket.on("forceRead", async () => {
      try {
        if (!socket.user?.id) {
          socket.emit("forceRead", { error: "Access denied" });
          return;
        }
        await this.prisma.chatMembersOnMessages.updateMany({
          where: {
            chatMember: { userId: socket.user.id, status: MemberStatus.ACTIVE },
          },
          data: { forceRead: true },
        });
        socket.emit("forceRead", { success: true });
      } catch (e: any) {
        socket.emit("forceRead", { error: e.message });
      }
    });

    socket.on("read", async (data: { id: string }) => {
      try {
        const { id } = data;
        if (!id) {
          socket.emit("read", { error: "Invalid id" });
          return;
        }
        if (!socket.user?.id) {
          socket.emit("read", { error: "Access denied" });
          return;
        }
        const conversation = await this.prisma.conversation.findFirst({
          where: {
            id,
            chatMembers: {
              some: { userId: socket.user.id, status: MemberStatus.ACTIVE },
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
        if (!conversation) {
          socket.emit("read", { error: "Conversation not found" });
          return;
        }
        await this.prisma.chatMembersOnMessages.updateMany({
          where: {
            message: { conversationId: id },
            chatMember: { userId: socket.user.id, status: MemberStatus.ACTIVE },
            read: false,
          },
          data: { read: true, readAt: new Date(), forceRead: true },
        });
        socket.emit("read", { success: true });
        const chatMemberJustRead = conversation.chatMembers.find(
          (_) => _.userId === socket.user.id,
        );
        socket.broadcast
          .to(conversation.roomId)
          .emit("newRead", chatMemberJustRead);
      } catch (e: any) {
        socket.emit("read", { error: e.message });
      }
    });

    socket.on(
      "sendMessage",
      async (data: {
        id: string;
        content: string;
        attachments: string[];
        targetMessageId: string | string;
      }) => {
        try {
          const { id, attachments } = data;
          const content = data.content ? censorProfane(data.content) : "";
          let targetMessageId = data.targetMessageId;
          if (!id) {
            socket.emit("sendMessage", { error: "Invalid conversationId" });
            return;
          }
          if (!socket.user?.id) {
            socket.emit("sendMessage", { error: "Access denied" });
            return;
          }
          const conversation = await this.prisma.conversation.findFirst({
            where: {
              id: id,
              chatMembers: {
                some: { userId: socket.user.id, status: MemberStatus.ACTIVE },
              },
            },
            include: { chatMembers: true },
          });
          if (!conversation) {
            socket.emit("sendMessage", { error: "Conversation not found" });
            return;
          }
          if (attachments) {
            for (const _ of attachments) {
              const attachment = await this.prisma.attachment.findFirst({
                where: { id: _ },
              });
              if (!attachment) {
                socket.emit("sendMessage", { error: "Attachment not found" });
                return;
              }
            }
          }

          const message = await this.prisma.message.create({
            data: {
              conversation: {
                connect: { id: id },
              },
              content,
              attachments:
                attachments && attachments.length
                  ? { connect: attachments.map((_) => ({ id: _ })) }
                  : undefined,
            },
          });
          await updateSearchAccent("message", message.id);
          if (attachments) {
            for (const _ of attachments) {
              await this.prisma.attachment.update({
                where: { id: _ },
                data: {
                  message: { connect: { id: message.id } },
                  conversation: { connect: { id: id } },
                },
              });
            }
          }
          if (targetMessageId) {
            targetMessageId = String(targetMessageId);
            const targetMessage = await this.prisma.message.findFirst({
              where: { id: targetMessageId },
            });
            if (!targetMessage) {
              socket.emit("sendMessage", { error: "Target message not found" });
              return;
            }
            await this.prisma.message.update({
              where: { id: message.id },
              data: { targetMessage: { connect: { id: targetMessageId } } },
            });
            await this.prisma.message.update({
              where: { id: targetMessageId },
              data: {
                replyMessages: { connect: { id: message.id } },
              },
            });
          }
          const chatMember = await this.prisma.chatMember.findFirst({
            where: {
              conversationId: conversation.id,
              userId: socket.user.id,
            },
          });

          await this.prisma.chatMembersOnMessages.create({
            data: {
              chatMember: {
                connect: {
                  id: chatMember.id,
                },
              },
              message: { connect: { id: message.id } },
              userView: UserView.SENDER,
              forceRead: true,
              read: true,
              readAt: new Date(),
            },
          });
          for (const _ of conversation.chatMembers) {
            if (_.userId === socket.user.id) {
              continue;
            }
            await this.prisma.chatMembersOnMessages.create({
              data: {
                chatMember: {
                  connect: {
                    id: _.id,
                  },
                },
                message: { connect: { id: message.id } },
                userView: UserView.RECEIVER,
                forceRead: false,
                read: false,
                readAt: null,
              },
            });
          }
          const rs = await this.getMessage(message.id, socket);
          this.chatNamespace.to(conversation.roomId).emit("newMessage", rs);
          const chatMembers = await prisma.chatMember.findMany({
            where: { conversationId: conversation.id },
          });
          const sockets = await this.fetchSockets(
            chatMembers.map((_) => _.userId),
          );
          for (const socket of sockets) {
            if (!socket.user) {
              continue;
            }
            await this.sendChatList(socket.user.id, conversation.id, socket);
            if (socket.rooms.has(conversation.roomId)) {
              await this.makeRead(socket.user.id, conversation.roomId, socket);
            }
          }
        } catch (e: any) {
          socket.emit("sendMessage", { error: e.message });
        }
      },
    );
  };

  private setupDisconnect = (socket: KGBSocket, namespace: string) => {
    socket.on("disconnect", async () => {
      if (socket.user) {
        const sockets = await this.fetchSockets([socket.user.id], namespace);
        for (const s of sockets) {
          s.disconnect();
          s.user = null;
        }
      }
    });
  };

  private getRoomMembers = async (roomId: string) => {
    const roomInfo = await this.io.in(roomId).fetchSockets();
    return roomInfo.length;
  };

  private setupSocketIO = () => {
    this.chatNamespace = this.io.of(this.chatNamespaceRouter);
    this.notificationNamespace = this.io.of(this.notificationNamespaceRouter);

    this.chatNamespace.on("connection", (socket: KGBSocket) => {
      this.setupLogin(socket, true);
      this.setupChat(socket);
      this.setupDisconnect(socket, this.chatNamespaceRouter);
    });

    this.io.on("connection", (socket: KGBSocket) => {
      this.setupDisconnect(socket, "/");
    });
  };
}

export default IO;
