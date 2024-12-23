import { render } from "@react-email/render";
import { BaseController } from "../../abstractions/base.controller";
import { Request } from "express";
import sendEmail from "../../email/process";
import RejectForm from "../../email/templates/reject";
import AcceptForm from "../../email/templates/accept";
import Welcome from "../../email/templates/welcome";
import { KGBResponse } from "../../util/global";
import { normalizeEmail } from "../../util";

export default class TestController extends BaseController {
  public path = "/api/v1/tests";

  public initializeRoutes() {
    this.router.post(``, this.test);
  }

  test = async (req: Request, res: KGBResponse) => {
    const email = normalizeEmail(req.body.email);
    const userFirstName = email.split("@")[0];

    const emailTemplates = [
      { template: RejectForm, subject: "Your form has been rejected" },
      { template: AcceptForm, subject: "Your form has been accepted" },
      { template: Welcome, subject: "Your Adventure Begins with KGBHub!" },
    ];

    try {
      await Promise.all(
        emailTemplates.map(async ({ template, subject }) => {
          const emailHtml = render(template({ userFirstName }));
          await sendEmail(emailHtml, email, subject);
        }),
      );

      return res.status(200).data({ message: "All emails sent successfully" });
    } catch (error) {
      console.error("Error sending emails:", error);
      return res.status(500).data({ message: "Error sending emails" });
    }
  };
}
