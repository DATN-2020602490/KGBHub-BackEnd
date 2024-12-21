import { CronJob } from "cron";
import { updateOrderStatus } from "../../modules/stripe/stripe.service";
import IO from "../../socket/io";

class StripeChecker {
  static start = (io: IO) => {
    const cron = new CronJob(
      "0 */5 * * * *",
      async function () {
        try {
          await updateOrderStatus(io);
        } catch (error) {
          console.error("paymentService.updateOrderStatus error", error);
        }
      },
      null,
      false,
    );
    cron.start();
  };
}

export default StripeChecker;
