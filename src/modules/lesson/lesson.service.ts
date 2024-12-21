import { LessonStatus } from "@prisma/client";
import prisma from "../../prisma";
import { refreshCourse } from "../course/course.service";

export const getLesson = async (
  id: string,
  userId: string,
  requireParentId = true,
) => {
  const lesson = await prisma.lesson.findFirst({
    where: { id, userId },
  });
  if (requireParentId) {
    const course = await prisma.course.findFirst({
      where: { parts: { some: { lessons: { some: { id } } } } },
    });
    if (course) {
      lesson["courseId"] = course.id;
      const part = await prisma.part.findFirst({
        where: { course: { id: course.id }, lessons: { some: { id } } },
      });
      if (part) {
        lesson["partId"] = part.id;
      }
    }
  }
  return lesson;
};
export const getLessons = async (
  id: string,
  limit: number,
  offset: number,
  status: LessonStatus,
) => {
  const where = {};
  where["userId"] = id;
  if (status) {
    where["status"] = status;
  }
  const lessons = await prisma.lesson.findMany({
    where,
    take: limit,
    skip: offset,
  });
  const total = await prisma.lesson.count({ where: { userId: id } });
  return { lessons, total };
};
export const deleteLesson = async (id: string) => {
  try {
    const lesson = await prisma.lesson.findFirst({
      where: { id },
      include: { part: true },
    });
    await prisma.comment.deleteMany({ where: { lessonId: id } });
    await prisma.heart.deleteMany({ where: { lessonId: id } });
    await prisma.bookmark.deleteMany({ where: { lessonId: id } });
    await prisma.lessonDone.deleteMany({
      where: { lessonId: id },
    });
    await prisma.lesson.delete({ where: { id } });
    await refreshCourse(lesson?.part.courseId || null);
  } catch (error) {
    console.log(error);
  }
};
