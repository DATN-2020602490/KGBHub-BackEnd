import "dotenv/config";
import StripeChecker from "./configs/cron/stripe.checker";
import migrate from "./util/migrate";
import RefreshData from "./configs/cron/refresh.data";
import { defaultImage, sleep } from "./util";
import app from "./app";
import "./bull";

async function bootstrap() {
  try {
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
