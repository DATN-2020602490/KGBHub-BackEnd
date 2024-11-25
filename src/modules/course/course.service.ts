import { CourseStatus, LessonType } from '@prisma/client';
import prisma from '../../configs/prisma';
import { userSelector } from '../../global';

export const refreshCourse = async (id: string) => {
  if (!id) {
    return;
  }
  const course = await prisma.course.findFirst({
    where: { id },
    include: {
      coursesPaid: {
        include: {
          user: userSelector,
        },
      },
      parts: {
        include: {
          lessons: true,
        },
      },
      rating: true,
    },
  });
  if (!course) {
    return;
  }
  let totalLessons = 0;
  let totalPart = 0;
  for (const part of course.parts) {
    totalLessons += part.lessons.length;
    totalPart += 1;
  }
  let totalDuration = 0;
  for (const part of course.parts) {
    for (const lesson of part.lessons) {
      if (lesson.lessonType === LessonType.VIDEO) {
        const video = await prisma.file.findFirst({
          where: { id: lesson.videoFileId },
        });
        totalDuration += video?.duration || 0;
      }
    }
  }
  let totalRating = 0;
  let countRate = 0;
  for (const rating of course.rating) {
    totalRating += rating.star;
    countRate += 1;
  }
  const avgRating = totalRating / countRate;
  await prisma.course.update({
    where: { id },
    data: {
      totalLesson: totalLessons,
      totalDuration,
      avgRating: avgRating,
      totalPart,
    },
  });
};
export const getCourse = async (id: string, userId: string, admin = false) => {
  if (admin) {
    const course = await prisma.course.findFirst({
      where: { id },
      include: {
        coursesPaid: {
          include: {
            user: userSelector,
          },
        },
        parts: {
          include: {
            lessons: true,
          },
        },
      },
    });
    return course;
  }
  const course = await prisma.course.findFirst({
    where: { id, userId },
    include: {
      coursesPaid: {
        include: {
          user: userSelector,
        },
      },
      parts: {
        include: {
          lessons: true,
        },
      },
    },
  });
  return course;
};
export const getCourses = async (
  id: string,
  limit: number,
  offset: number,
  admin = false,
  orderBy: string,
  direction: string,
  search?: string,
  status?: CourseStatus,
) => {
  const where = {};
  if (status) {
    where['status'] = status;
  }
  if (!admin) {
    where['userId'] = id;
  }
  if (search) {
    where['courseName'] = {
      contains: search,
    };
    where['descriptionMD'] = {
      contains: search,
    };
  }
  const courses = await prisma.course.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: {
      [orderBy]: direction,
    },
    include: {
      coursesPaid: {
        include: {
          user: userSelector,
        },
      },
      parts: {
        include: {
          lessons: true,
        },
      },
    },
  });
  const total = await prisma.course.count({ where });
  return { courses, total };
};

export const refreshPart = async (courseId: string) => {
  let count = 1;
  const parts = await prisma.part.findMany({
    where: { courseId },
    orderBy: { partNumber: 'asc' },
  });
  for (const _ of parts) {
    await prisma.part.update({
      where: { id: _.id },
      data: { partNumber: count++ },
    });
  }
};
export const deleteCourse = async (id: string) => {
  try {
    await prisma.heart.deleteMany({ where: { courseId: id } });
    const parts = await prisma.part.findMany({
      where: { courseId: id },
      include: { lessons: true },
    });
    for (const part of parts) {
      for (const lesson of part.lessons) {
        await prisma.comment.deleteMany({
          where: { lessonId: lesson.id },
        });
        await prisma.heart.deleteMany({
          where: { lessonId: lesson.id },
        });
        await prisma.bookmark.deleteMany({
          where: { lessonId: lesson.id },
        });
        await prisma.lessonDone.deleteMany({
          where: { lessonId: lesson.id },
        });
      }
      await prisma.lesson.deleteMany({
        where: { partId: part.id },
      });
      await prisma.part.delete({ where: { id: part.id } });
    }
    await prisma.rating.deleteMany({ where: { courseId: id } });
    await prisma.bookmark.deleteMany({ where: { courseId: id } });
    await prisma.coursesPaid.deleteMany({
      where: { courseId: id },
    });
    await prisma.courseDone.deleteMany({
      where: { courseId: id },
    });
    await prisma.course.delete({ where: { id } });
  } catch (error) {
    console.log(error);
  }
};

export const deletePart = async (id: string) => {
  const part = await prisma.part.findFirst({
    where: { id },
    include: { course: true },
  });
  const lessons = await prisma.lesson.findMany({
    where: { partId: id },
  });
  for (const lesson of lessons) {
    await prisma.comment.deleteMany({
      where: { lessonId: lesson.id },
    });
    await prisma.heart.deleteMany({
      where: { lessonId: lesson.id },
    });
    await prisma.bookmark.deleteMany({
      where: { lessonId: lesson.id },
    });
    await prisma.lessonDone.deleteMany({
      where: { lessonId: lesson.id },
    });
  }
  await prisma.lesson.deleteMany({ where: { partId: id } });
  await prisma.part.delete({ where: { id } });
  await refreshCourse(part?.courseId || null);
};
