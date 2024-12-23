/* eslint-disable @typescript-eslint/ban-types */
import { RemoteSocket, Socket } from "socket.io";
import { Request, Response } from "express";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import {
  Platform,
  RoleEnum,
  LessonType,
  LessonStatus,
  CourseStatus,
  CourseCategory,
  Currency,
  FormStatus,
  ProductStatus,
  ProductType,
  OrderStatus,
  PaymentPlatform,
  ConversationType,
  ChatMemberRole,
  MemberStatus,
  UserView,
  CampaignType,
  VoucherType,
  Prisma,
} from "@prisma/client";
import {
  DynamicClientExtensionThis,
  InternalArgs,
} from "@prisma/client/runtime/library";

export type ExtendPrisma = DynamicClientExtensionThis<
  Prisma.TypeMap<
    InternalArgs & {
      result: {};
      model: {};
      query: {};
      client: {};
    },
    Prisma.PrismaClientOptions
  >,
  Prisma.TypeMapCb,
  {
    result: {};
    model: {};
    query: {};
    client: {};
  },
  {}
>;

export const limitDefault = 12;
export const offsetDefault = 0;

export const REDIS_HOST = process.env.REDIS_HOST;
export const REDIS_PORT = parseInt(process.env.REDIS_PORT as string);

export const QUEUE_NAMES = {
  sendEmailCampaign: "sendEmailCampaign",
  deactivateCampaign: "deactivateCampaign",
};

export type KGBSocket = Socket & AddonUserOnSocket;

export const GLOBAL_REVENUE_SHARE = 0.7;

export const userSelector = {
  select: {
    id: true,
    username: true,
    email: true,
    firstName: true,
    lastName: true,
    avatarFileId: true,
    coverFileId: true,
  },
};

export type ReportData = {
  [dateKey: string]: {
    totalOriginalAmount: number;
    totalAmount: number;
    totalOrder: number;
    totalFee?: number; // just show in system
    totalTip?: number; // just show in system
  };
};

export type ReportTable = {
  groupBy: string;
  startDate: number | Date;
  endDate: number | Date;
  target: "system" | "author";
  authorId?: string;
  author: User;
  systemReport?: ReportData;
  authorReport?: ReportData;
};

export type KGBRequest = Request & {
  user: User;
  fileModel?: fileModel;
  fileModels?: fileModels;
  fileModelsWithFieldName?: fileModelsWithFieldName;
  /**
   * Retrieves a request parameter by key, normalizes email values, and validates the parameter.
   *
   * @param key - The key of the request parameter to retrieve.
   * @param defaultValue - The default value to return if the parameter is not found.
   * @param validate - The validation criteria, which can be a function, an array, a regular expression, or an
   *                  object.
   *
   * @returns The validated and possibly converted value of the parameter. If the parameter is not found,
   *          the default value is returned. Throws an error if the parameter is missing or invalid according
   *          to the validation criteria.
   */
  gp: <T>(
    key: string,
    defaultValue?: T,
    validate?: ((val: T) => T | undefined) | T[] | RegExp | object,
  ) => T | null;
  genNextUrl: (data: any[]) => string;
};

export type fileModel = File;
export type fileModels = File[];
export type fileModelsWithFieldName = { [fieldname: string]: File[] };

export type KGBResponse = Response & {
  /**
   * Responds with a success response.
   *
   * @param {any} data The data to be returned.
   * @param {object} [option] The options.
   * @param {object} [option.meta] The meta data.
   * @param {number} [option.code] The HTTP status code, defaults to 200.
   * @returns {Response} The response.
   */
  data: (data: any, total?: number, option?: any) => KGBResponse;
  /**
   * Returns an error response with the given error message or object.
   *
   * @param {string|Error} error - The error message or object.
   * @returns {void}
   */
  error: (error: string | Error) => void;
  createResponse: (data: any, total?: number, option?: any) => ResponseData;
};
export type ResponseData =
  | {
      data: any[];
      option?: any;
      pagination: {
        page: number;
        totalPages: number;
        total: number;
        next: string;
      };
    }
  | {
      data: any;
      option?: any;
    };

export type ConversationWithLastMessage = {
  conversation: Conversation & { unreadMessages: number };
  lastMessage?: Message;
};

export type KGBRemoteSocket = RemoteSocket<DefaultEventsMap, any> &
  AddonUserOnSocket;

export type AddonUserOnSocket = { user: User };

export type User = {
  id: string;

  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  searchAccent?: string;
  gender?: string;
  roles: UserRole[];
  phone?: string;
  address?: string;
  avatarFileId?: string;
  avatarFile?: File;
  coverFileId?: string;
  coverFile?: File;
  birthday?: Date;
  platform: Platform;
  refreshToken?: string;
  firstTime: boolean;
  isNewUser: boolean;
  syncWithGoogle: boolean;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  comments: Comment[];
  hearts: Heart[];

  lessons: Lesson[];
  courses: Course[];

  coursesPaid: CoursesPaid[];
  submitForms: SubmitForm[];
  rating: Rating[];
  bookmarks: Bookmark[];
  lessonDones: LessonDone[];
  courseDones: CourseDone[];

  lastReset?: Date;
  cart: Cart[];

  orders: Order[];
  referredOrders: Order[];
  chatMembers: ChatMember[];
  attachments: Attachment[];
  files: File[];
  campaignUsers: CampaignUser[];
};

export type Role = {
  id: string;
  name: RoleEnum;
  description: string;
  userRole: UserRole[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type UserRole = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  role: Role;
  roleId: string;
  user: User;
  userId: string;
};

export type Lesson = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  lessonName: string;
  lessonNumber: number;
  searchAccent?: string;
  duration?: number;

  lessonType: LessonType;

  trialAllowed: boolean;
  descriptionMD?: string;

  status: LessonStatus;

  title?: string;
  content?: string;

  videoFileId?: string;
  videoFile?: File;

  thumbnailFileId?: string;
  thumbnailFile?: File;

  user: User;
  userId: string;

  comments: Comment[];
  hearts: Heart[];
  bookmarks: Bookmark[];
  part: Part;
  partId: string;
  lessonDones: LessonDone[];
};

export type Course = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  totalLesson: number;
  totalPart: number;
  courseName: string;
  totalDuration: number;
  knowledgeGained: string[];
  isPublic: boolean;
  status: CourseStatus;
  searchAccent?: string;

  avgRating?: number;
  totalRating: number;

  thumbnailFileId?: string;
  thumbnailFile?: File;

  category: CourseCategory;

  priceAmount: number;
  currency: Currency;

  descriptionMD?: string;

  user: User;
  userId: string;

  // lessons      Lesson[]
  hearts: Heart[];
  parts: Part[];

  coursesPaid: CoursesPaid[];
  rating: Rating[];
  bookmarks: Bookmark[];
  courseDones: CourseDone[];
  coursesOnCarts: CoursesOnCarts[];
  products: Product[];
  conversations: Conversation[];
  campaignDiscounts: CampaignDiscount[];
};

export type CoursesPaid = {
  id: string;

  course: Course;
  courseId: string;
  user: User;
  userId: string;

  isFree: boolean;

  order: Order;
  orderId: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Cart = {
  id: string;

  user: User;
  userId: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  coursesOnCarts: CoursesOnCarts[];
};

export type CoursesOnCarts = {
  id: string;

  course: Course;
  courseId: string;

  addedAt: Date;

  cart: Cart;
  cartId: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Part = {
  id: string;
  partNumber: number;
  partName: string;
  description?: string;

  lessons: Lesson[];

  course: Course;
  courseId: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  lesson?: Lesson;
  lessonId?: string;
  searchAccent?: string;
  user: User;
  userId: string;

  level: number;
  parentId?: string;
  parent?: Comment;
  children: Comment[];
};

export type Heart = {
  id: string;

  user: User;
  userId: string;

  lesson?: Lesson;
  lessonId?: string;
  course?: Course;
  courseId?: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  message?: Message;
  messageId?: string;
};

export type LessonDone = {
  id: string;

  lesson: Lesson;
  lessonId: string;
  user: User;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type CourseDone = {
  id: string;

  course: Course;
  courseId: string;
  user: User;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type SubmitForm = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  user: User;
  userId: string;

  real_firstName: string;
  real_lastName: string;

  selfie?: string;

  frontIdCard?: string;
  backIdCard?: string;

  linkCV?: string;

  category: CourseCategory;

  status: FormStatus;
};

export type Rating = {
  id: string;

  user: User;
  userId: string;
  course: Course;
  courseId: string;

  content?: string;

  star: number;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Bookmark = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  user: User;
  userId: string;

  lesson?: Lesson;
  lessonId?: string;
  course?: Course;
  courseId?: string;
};

export type ProductOrder = {
  id: string;
  productId: string;
  product: Product;
  price: number;
  quantity: number;
  orderId: string;
  order: Order;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Product = {
  id: string;
  status: ProductStatus;
  type: ProductType;
  name: string;
  description?: string;
  period?: number;
  price: number;
  currency: Currency;
  images: string[];

  course?: Course;
  courseId?: string;

  productStripeId?: string;
  productOrders: ProductOrder[];

  tags: string[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Order = {
  id: string;
  userId: string;
  user: User;
  productOrders: ProductOrder[];

  status: OrderStatus;
  amount: number;
  currency: Currency;
  checkoutUrl?: string;
  vouchers: Voucher[];

  platform: PaymentPlatform;

  platformFee: number;

  KGBHubServiceTip: number;

  stripeCheckoutId?: string;
  stripePriceId?: string;
  stripeSubscriptionId?: string;

  originalAmount: number;
  originalFee: number;

  coursesPaids: CoursesPaid[];

  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  referredBy?: User;
  referredById?: string;
};

export type Conversation = {
  id: string;

  messages: Message[];
  searchAccent?: string;
  avatarFileId?: string;
  avatar?: string;

  roomId: string;

  conversationName?: string;

  conversationType: ConversationType;

  chatMembers: ChatMember[];

  course?: Course;
  courseId?: string;

  attachments: Attachment[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type ChatMember = {
  id: string;

  user: User;
  userId: string;

  conversation: Conversation;
  conversationId: string;

  chatMemberRole: ChatMemberRole;
  chatMembersOnMessages: ChatMembersOnMessages[];

  isMute: boolean;

  status: MemberStatus;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Message = {
  id: string;

  content: string;
  searchAccent?: string;
  attachments: Attachment[];

  conversation: Conversation;
  conversationId: string;

  recalled: boolean;

  targetMessageId?: string;

  targetMessage?: Message;
  replyMessages: Message[];

  hearts: Heart[];

  chatMembersOnMessages: ChatMembersOnMessages[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type ChatMembersOnMessages = {
  id: string;
  chatMember: ChatMember;
  chatMemberId: string;

  message: Message;
  messageId: string;

  userView: UserView;

  forceRead: boolean;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type File = {
  id: string;

  localPath?: string;
  filename?: string;
  duration?: number;
  originalName?: string;
  filesize: string;
  mimetype: string;

  ownerId?: string;
  owner?: User;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Attachment = {
  id: string;

  fileId?: string;
  file?: File;
  mimetype?: string;
  originalName?: string;
  searchAccent?: string;
  userId?: string;
  user?: User;

  conversationId?: string;
  conversation?: Conversation;

  message?: Message;
  messageId?: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Migrate = {
  name: string;
  runAt: Date;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Campaign = {
  id: string;

  type: CampaignType;
  name: string;
  searchAccent?: string;
  description?: string;
  coverFileId?: string;
  startAt: Date;
  endAt: Date;
  active: boolean;
  totalFeeVoucher?: number;
  feeVoucherValue?: number;
  totalProductVoucher?: number;
  productVoucherValue?: number;

  discountFrom?: number;
  discountTo?: number;
  totalVoucher: number;
  totalUsed: number;

  campaignUsers: CampaignUser[];
  vouchers: Voucher[];
  campaignDiscounts: CampaignDiscount[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type CampaignDiscount = {
  id: string;

  campaign: Campaign;
  campaignId: string;

  value: number;

  courseId: string;
  course: Course;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type CampaignUser = {
  id: string;

  campaign: Campaign;
  campaignId: string;

  user: User;
  userId: string;
  vouchers: Voucher[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type Voucher = {
  id: string;

  type: VoucherType;

  code: string;

  value: number;

  isUsed: boolean;

  order?: Order;
  orderId?: string;

  campaign?: Campaign;
  campaignId?: string;

  campaignUser?: CampaignUser;
  campaignUserId?: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};
