import { ConversationType, CourseStatus, LessonType } from "@prisma/client";
import prisma from "../../prisma";
import { userSelector } from "../../util/global";
import getVideoDurationInSeconds from "get-video-duration";
import { removeAccent } from "../../prisma/prisma.service";

export const refreshCourse = async (id: string) => {
  if (!id) return;
  await refreshPart(id);
  const course = await prisma.course.findFirst({
    where: { id },
    include: {
      parts: {
        include: {
          lessons: {
            select: {
              id: true,
              lessonType: true,
              videoFileId: true,
            },
          },
        },
      },
      rating: {
        select: {
          star: true,
        },
      },
    },
  });

  if (!course) return;

  const totalPart = course.parts.length;
  const totalLessons = course.parts.reduce(
    (count, part) => count + part.lessons.length,
    0,
  );

  const videoFileIds = course.parts.flatMap((part) =>
    part.lessons
      .filter(
        (lesson) =>
          lesson.lessonType === LessonType.VIDEO && lesson.videoFileId,
      )
      .map((lesson) => lesson.videoFileId),
  );

  const videoFiles = await prisma.file.findMany({
    where: { id: { in: videoFileIds } },
  });

  let totalDuration = 0;
  for (const video of videoFiles) {
    if (video.duration === null || video.duration === undefined) {
      try {
        video.duration = await getVideoDurationInSeconds(video.localPath);
      } catch {
        video.duration = 0;
      }
      await prisma.lesson.updateMany({
        where: { videoFileId: video.id },
        data: {
          duration: video.duration,
        },
      });
      await prisma.file.update({
        where: { id: video.id },
        data: { duration: video.duration },
      });
    }

    totalDuration += video.duration;
  }

  const { totalRating, countRate } = course.rating.reduce(
    (acc, rating) => {
      acc.totalRating += rating.star;
      acc.countRate += 1;
      return acc;
    },
    { totalRating: 0, countRate: 0 },
  );

  const avgRating = countRate > 0 ? totalRating / countRate : 0;

  await prisma.course.update({
    where: { id },
    data: {
      totalLesson: totalLessons,
      totalDuration,
      avgRating,
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
    where["status"] = status;
  }
  if (!admin) {
    where["userId"] = id;
  }
  if (search) {
    where["searchAccent"] = {
      contains: removeAccent(search),
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
    orderBy: { partNumber: "asc" },
  });
  for (const _ of parts) {
    await prisma.part.update({
      where: { id: _.id },
      data: { partNumber: count++ },
    });
  }
};

export const deleteCourse = async (id: string) => {
  await prisma.$transaction(async (prisma) => {
    await prisma.chatMembersOnMessages.deleteMany({
      where: {
        message: {
          conversation: {
            course: { id },
            conversationType: ConversationType.COURSE_GROUP_CHAT,
          },
        },
      },
    });

    await prisma.message.deleteMany({
      where: {
        conversation: {
          course: { id },
          conversationType: ConversationType.COURSE_GROUP_CHAT,
        },
      },
    });

    await prisma.chatMember.deleteMany({
      where: {
        conversation: {
          course: { id },
          conversationType: ConversationType.COURSE_GROUP_CHAT,
        },
      },
    });

    await prisma.conversation.deleteMany({
      where: {
        course: { id },
        conversationType: ConversationType.COURSE_GROUP_CHAT,
      },
    });

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
  });
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
