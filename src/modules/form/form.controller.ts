import { BaseController } from "../../abstractions/base.controller";
import { KGBAuth } from "../../configs/passport";
import checkRoleMiddleware from "../../middlewares/checkRole.middleware";
import { KGBResponse } from "../../util/global";
import { render } from "@react-email/render";
import sendEmail from "../../email/process";
import AcceptForm from "../../email/templates/accept";
import RejectForm from "../../email/templates/reject";
import { RoleEnum, FormStatus } from "@prisma/client";
import { KGBRequest } from "../../util/global";

export default class FormController extends BaseController {
  public path = "/api/v1/forms";

  public initializeRoutes() {
    this.router.get(
      `/`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      this.getForms,
    );
    this.router.get(
      `/:id`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      this.getForm,
    );
    this.router.patch(
      `/:id`,
      KGBAuth("jwt"),
      checkRoleMiddleware([RoleEnum.ADMIN]),
      this.updateForm,
    );
  }

  getForms = async (req: KGBRequest, res: KGBResponse) => {
    const forms = await this.prisma.submitForm.findMany();
    return res.status(200).data(forms);
  };
  getForm = async (req: KGBRequest, res: KGBResponse) => {
    const id = req.gp<string>("id", undefined, String);
    const form = await this.prisma.submitForm.findFirst({ where: { id } });
    return res.status(200).data(form);
  };
  updateForm = async (req: KGBRequest, res: KGBResponse) => {
    const reqUser = req.user;
    const id = req.gp<string>("id", undefined, String);
    const status = req.body.status as FormStatus;
    const form = await this.prisma.submitForm.update({
      where: { id },
      data: { status: status },
      include: { user: true },
    });
    if (status === FormStatus.APPROVED) {
      const _ = await this.prisma.submitForm.findFirst({
        where: { id },
        include: { user: true },
      });
      const __ = await this.prisma.userRole.findFirst({
        where: { userId: _?.user.id, role: { name: RoleEnum.AUTHOR } },
        include: { role: true },
      });
      if (!__) {
        await this.prisma.userRole.create({
          data: {
            user: { connect: { id: _?.user.id } },
            role: { connect: { name: RoleEnum.AUTHOR } },
          },
        });
      }
      const emailHtml = render(
        AcceptForm({
          userFirstName: form.user.firstName,
        }),
      );
      await sendEmail(
        emailHtml,
        form.user.email,
        "Your form has been approved",
      );
    } else {
      const _ = await this.prisma.submitForm.findFirst({
        where: { id },
        include: { user: true },
      });
      const __ = await this.prisma.userRole.findFirst({
        where: { userId: _?.user.id, role: { name: RoleEnum.AUTHOR } },
        include: { role: true },
      });
      if (__ && _) {
        await this.prisma.userRole.deleteMany({
          where: {
            userId: _.user.id,
            role: { name: RoleEnum.AUTHOR },
          },
        });
      }
      const emailHtml = render(
        RejectForm({
          userFirstName: form.user.firstName,
        }),
      );
      await sendEmail(
        emailHtml,
        form.user.email,
        "Your form has been rejected",
      );
    }
    return res.status(200).data(form);
  };
}
