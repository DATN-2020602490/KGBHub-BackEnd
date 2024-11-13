import prisma from '../configs/prisma';

export const processStarReport = async (data: any) => {
  const total = {
    course: { id: -1, name: 'Total' },
    stars: [
      { star: 1, total: 0 },
      { star: 2, total: 0 },
      { star: 3, total: 0 },
      { star: 4, total: 0 },
      { star: 5, total: 0 },
      { avgStar: 0, total: 0 },
    ],
  };
  let totalRate = 0;
  let totalStar = 0;
  const result = [] as any[];
  for (const _ in data) {
    const course = await prisma.course.findUnique({
      where: { id: _ },
    });
    if (!course) {
      continue;
    }
    if (!course.totalRating || !course.avgRating) {
      continue;
    }
    totalRate += course.totalRating;
    totalStar += course.avgRating * course.totalRating;
    result.push({
      course: {
        id: course.id,
        name: course.courseName,
        thumbnailFileId: course.thumbnailFileId,
        thumbnailFile: await prisma.file.findFirst({
          where: { id: course.thumbnailFileId },
        }),
      },
      stars: data[_],
    });
    for (const __ of data[_]) {
      if (!__.star) {
        continue;
      }
      total.stars[__.star - 1].total += __.total;
    }
  }
  total.stars[5].avgStar = totalStar / totalRate;
  total.stars[5].total = totalRate;
  result.push(total);
  return result;
};
export const validateSlug = (slug: string) => {
  if (slug === '') {
    return true;
  }
  if (slug.length < 3) {
    return false;
  }

  for (const char of slug) {
    if (!/[a-z0-9-_.]/.test(char)) {
      return false;
    }
  }

  return true;
};
export const validateBio = (bio: string) => {
  return bio.length <= 500;
};
export const validateUsername = (username: string): boolean => {
  if (username.length < 6 || username.length > 20) {
    return false;
  }

  const regex = /^[a-zA-Z0-9_.-]+$/;
  if (!regex.test(username)) {
    return false;
  }

  if (username.includes(' ')) {
    return false;
  }
  return true;
};
export const normalizeEmail = (email: string): string => {
  const splitEmail = email.split('@');
  let domain = '';
  if (splitEmail.length > 1) {
    email = email.includes('@') ? email.split('@')[0] : email;
    domain = splitEmail[1];
  }
  const normalizedEmail = email.replace(/\./g, '');
  return normalizedEmail.toLowerCase().concat(domain ? `@${domain}` : '');
};
export const createSlug = (title: string) =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const getUniqueSuffix = async (field: string, model: any, previous = '') => {
  let uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  while (await model.findFirst({ where: { [field]: `${previous}${uniqueSuffix}` } })) {
    uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  }
  return uniqueSuffix;
};
