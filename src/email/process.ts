import { createTransport } from "nodemailer";
import oAuthClient2 from "../configs/google.oauth2";
import { normalizeEmail } from "../util";

const sendEmail = async (emailHtml: string, to: string, subject: string) => {
  to = normalizeEmail(to);
  if (!to || (!emailHtml && !subject)) {
    return;
  }
  const accessToken = (await oAuthClient2.getAccessToken()) as any;
  const gmail = createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_SENDER,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN,
      accessToken,
    },
  });
  await gmail.sendMail({
    from: process.env.EMAIL_SENDER,
    to,
    subject,
    html: emailHtml,
  });
};
export default sendEmail;
