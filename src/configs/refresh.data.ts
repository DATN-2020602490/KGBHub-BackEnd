import { getVideoDurationInSeconds } from 'get-video-duration';
import { CronJob } from 'cron';
import { LessonType } from '@prisma/client';
import { Lesson } from '../global';
import prisma from './prisma';

const RefreshData = new CronJob(
  '0 */5 * * * *',
  async function () {
    console.log('REFRESH DATA');

    const courses = await prisma.course.findMany();
    for (const _ of courses) {
      try {
        const rates = await prisma.rating.findMany({
          where: { courseId: _.id },
        });
        const avgRating = rates.reduce((acc, cur) => acc + cur.star, 0) / (rates.length || 1);
        await prisma.course.update({
          where: { id: _.id },
          data: { totalRating: rates.length || 0, avgRating: avgRating || 0 },
        });
        const lessons = (await prisma.lesson.findMany({
          where: { part: { courseId: _.id } },
          include: { part: true },
        })) as Lesson[];
        for (const __ of lessons) {
          const videoFile = await prisma.file.findFirst({
            where: { id: __.videoFileId },
          });
          __.videoFile = videoFile;
          const thumbnailFile = await prisma.file.findFirst({
            where: { id: __.thumbnailFileId },
          });
          __.thumbnailFile = thumbnailFile;
        }
        let totalDuration = 0;
        let totalLesson = 0;
        for (const __ of lessons) {
          try {
            if (__.videoFile.localPath && __.lessonType === LessonType.VIDEO) {
              let duration = 0;
              try {
                duration = await getVideoDurationInSeconds(__.videoFile.localPath);
              } catch (e) {}
              totalDuration += duration;
              await prisma.file.update({
                where: { id: __.videoFileId },
                data: { duration },
              });
            }
            totalLesson++;
          } catch (error) {
            console.log(error);

            totalLesson++;
            totalDuration += 0;
          }
        }
        await prisma.course.update({
          where: { id: _.id },
          data: { totalDuration, totalLesson },
        });
      } catch (error) {
        console.log(error);
      }
    }
  },
  null,
  false,
);

export default RefreshData;
