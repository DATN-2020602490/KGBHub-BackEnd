import { existsSync } from "fs";
import prisma from "../prisma";
import {
  RegExpMatcher,
  TextCensor,
  asteriskCensorStrategy,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import vn_bad_words from "../configs/vn_profane.json";

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

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const checkCondition = (condition: any, message: string | Error) => {
  if (!condition) {
    if (typeof message === "string") {
      const error = new Error();

      if (typeof message === "string") {
        error.message = message;
      } else {
        Object.assign(error, message);
      }

      throw error;
    }
    throw message;
  }
};

export const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export const checkBadWord = (text: string) => {
  checkCondition(!matcher.hasMatch(text ?? ""), "Some fields are profane");
  for (const word of vn_bad_words) {
    checkCondition(!text.includes(word), "Some fields are profane");
  }
  return text;
};

export const censorProfane = (text: string) => {
  for (const word of vn_bad_words) {
    if (text.includes(word)) {
      const length = word.length;
      const index = text.indexOf(word);
      text =
        text.slice(0, index) + "*".repeat(length) + text.slice(index + length);
    }
  }
  const censor = new TextCensor();
  censor.setStrategy(asteriskCensorStrategy());
  const matches = matcher.getAllMatches(text);
  text = censor.applyTo(text, matches);
  return text;
};
