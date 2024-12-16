import { existsSync } from "fs";
import prisma from "../configs/prisma";
import removeAccents from "remove-accents";
import { htmlToText } from "html-to-text";

const SLUG_REGEX = /^[a-z0-9-_.]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
const RANDOM_CHARS =
  "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890";

export const validateSlug = (slug: string): boolean =>
  slug === "" || (slug.length >= 3 && SLUG_REGEX.test(slug));

export const validateBio = (bio: string): boolean => bio.length <= 500;

export const validateUsername = (username: string): boolean =>
  username.length >= 6 &&
  username.length <= 20 &&
  USERNAME_REGEX.test(username) &&
  !username.includes(" ");

export const normalizeEmail = (email: string): string => {
  const [localPart, domain] = email.split("@");
  return `${localPart.replace(/\./g, "").toLowerCase()}@${domain}`;
};

export const createSlug = (title: string): string =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const getUniqueSuffix = async (
  field: string,
  model: any,
  previous = "",
): Promise<string> => {
  let uniqueSuffix;
  do {
    uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  } while (
    await model.findFirst({ where: { [field]: `${previous}${uniqueSuffix}` } })
  );
  return `${previous}${uniqueSuffix}`;
};

export const generateRandomString = (length = 5): string =>
  Array.from({ length }, () =>
    RANDOM_CHARS.charAt(Math.floor(Math.random() * RANDOM_CHARS.length)),
  ).join("");

export const calculateStripeWithFee = (price: number): number =>
  +(price * 1.043 + 0.3).toFixed(2);

export const removeFeeFromPrice = (price: number): number =>
  +((price - 0.3) / 1.043).toFixed(2);

export const toStripePrice = (price: number): string =>
  Math.floor(price * 100).toString();

export const defaultImage = async (): Promise<void> => {
  const defaultImageName = "0.jpg";
  const defaultImagePath = `uploads/${defaultImageName}`;

  const existingImage = await prisma.file.findFirst({
    where: { filename: defaultImageName, originalName: defaultImageName },
  });

  if (!existingImage && existsSync(defaultImagePath)) {
    await prisma.file.create({
      data: {
        filename: defaultImageName,
        originalName: defaultImageName,
        mimetype: "image/jpeg",
        filesize: "0",
        localPath: defaultImagePath,
      },
    });
  }
};

export const filterDeletedRecords = (data) => {
  if (Array.isArray(data)) {
    return data.filter((item) => !item.deletedAt).map(filterDeletedRecords);
  } else if (data && typeof data === "object") {
    for (const key in data) {
      if (
        data[key] &&
        (Array.isArray(data[key]) || typeof data[key] === "object")
      ) {
        data[key] = filterDeletedRecords(data[key]);
      }
    }
    return data.deletedAt ? null : data;
  }
  return data;
};

export const removeAccent = (text) => {
  return htmlToText(
    text
      .normalize("NFD")
      .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "")
      .replace(/[\u02C6\u0306\u031B]/g, "")
      .replace(/[đĐ]/g, (d) => (d === "đ" ? "d" : "D"))
      .normalize("NFC")
      .toLowerCase()
      .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
      .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
      .replace(/ì|í|ị|ỉ|ĩ/g, "i")
      .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
      .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
      .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
      .replace(/đ/g, "d")
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9]/g, ""),
  );
};
