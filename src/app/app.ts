import { Server } from "http";
import express from "express";
import cors from "cors";
import IO from "../socket/io";
import { BaseController } from "../abstractions/base.controller";
import { KGBRequest, KGBResponse } from "../util/global";
import errorMiddleware from "../middlewares/error.middleware";
import rioMiddleware from "../middlewares/rio.middleware";
import AuthController from "../modules/auth/auth.controller";
import CampaignController from "../modules/campaign/campaign.controller";
import ChatController from "../modules/chat/chat.controller";
import CourseController from "../modules/course/course.controller";
import FileController from "../modules/file/file.controller";
import FormController from "../modules/form/form.controller";
import InteractController from "../modules/interact/interact.controller";
import LessonController from "../modules/lesson/lesson.controller";
import BookmarkController from "../modules/public/bookmark/bookmark.controller";
import CartController from "../modules/public/cart/cart.controller";
import PublicCourseController from "../modules/public/course/course.controller";
import PublicLessonController from "../modules/public/lesson/lesson.controller";
import ReportMockController from "../modules/report/report-mock.controller";
import StripeController from "../modules/stripe/stripe.controller";
import TestController from "../modules/test/test.controller";
import UserController from "../modules/user/user.controller";

class App {
  public app: express.Application;
  public port: number | string;
  private server: Server;
  public io: IO;
  private controllers: BaseController[] = [];

  constructor(port: number | string) {
    this.app = express();
    this.port = port;

    this.server = new Server(this.app);
    this.io = new IO(this.server);

    this.controllers = [
      new UserController(),
      new AuthController(),
      new StripeController(),
      new ChatController(),
      new InteractController(),
      new CourseController(),
      new LessonController(),
      new FileController(),
      new PublicCourseController(),
      new PublicLessonController(),
      new FormController(),
      new BookmarkController(),
      new TestController(),
      new CartController(),
      // new ReportController(),
      new CampaignController(),
      new ReportMockController(),
      new TestController(),
    ];

    this.initializeMiddlewares();
    this.initializeControllers();
    this.initializeErrorHandling();
  }

  public listen() {
    this.server.listen(this.port, () => {
      console.log(`👌 App listening on the port ${this.port}`);
    });
  }

  private initializeMiddlewares() {
    this.app.use(
      express.json({
        verify: function (req: any, res, buf) {
          req.rawBody = buf;
        },
      }),
    );
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cors());
    this.app.use(rioMiddleware);
  }

  private initializeErrorHandling() {
    this.app.use((req: KGBRequest, res: KGBResponse) => {
      return res.status(404).error("404 Not found");
    });

    this.app.use(errorMiddleware);
  }

  private initializeControllers() {
    this.app.get("/", (request, response) => {
      response.send("Application is running");
    });

    this.controllers.forEach((controller) => {
      controller.io = this.io;
      controller.initializeRoutes();

      this.app.use(controller.path, controller.router.router);
    });
  }
}

export default App;
