import { google } from "googleapis";

const oAuthClient2 = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL,
);
oAuthClient2.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

export default oAuthClient2;
