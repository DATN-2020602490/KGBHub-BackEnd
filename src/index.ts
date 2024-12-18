import "dotenv/config";
import App from "./app";
import StripeChecker from "./configs/stripe.checker";
import migrate from "./migrate";
import "./configs/prisma.middleware";
import RefreshData from "./configs/refresh.data";
import { defaultImage, sleep } from "./util";

async function bootstrap() {
  try {
    (global as any).check = (condition: any, message: string | Error) => {
      if (!condition) {
        if (typeof message === "string") {
          const error = new Error();

          if (typeof message === "string") {
            error.message = message;
          } else {
            Object.assign(error, message);
          }

          throw error;
        }
        throw message;
      }
    };

    const port = process.env.PORT || 3000;
    const app = new App(port);

    app.listen();
    defaultImage().catch(console.log);
    migrate.init();
    RefreshData.start();
    StripeChecker.start(app.io);
  } catch (error) {
    console.log(error);
    await sleep(5000);
    return bootstrap();
  }
}

bootstrap();
