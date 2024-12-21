import { CronJob } from "cron";
import prisma from "../../prisma";
import { refreshCourse } from "../../modules/course/course.service";

const RefreshData = new CronJob(
  "0 */5 * * * *",
  async function () {
    const courses = await prisma.course.findMany();
    for (const _ of courses) {
      try {
        await refreshCourse(_.id);
      } catch (e) {
        console.log("At course id: ", _.id);
        console.log(e);
      }
    }
  },
  null,
  false,
);

export default RefreshData;
