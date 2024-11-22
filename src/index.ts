import 'dotenv/config';
import App from './app';
import StripeChecker from './configs/stripe.checker';
import migrate from './migrate';
import './configs/prisma.middleware';
import RefreshData from './configs/refresh.data';

(global as any).check = (condition: any, message: string | Error) => {
  if (!condition) {
    if (typeof message === 'string') {
      const error = new Error();

      if (typeof message === 'string') {
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

migrate.init();
RefreshData.start();
StripeChecker.start(app.io);
