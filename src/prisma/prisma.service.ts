import { htmlToText } from "html-to-text";
import prisma from ".";
import { cloneDeep, isArray, isDate, isObjectLike } from "lodash";

export const searchAccentMap = [
  {
    model: "user",
    fields: ["firstName", "lastName", "username", "email"],
  },
  {
    model: "course",
    fields: ["courseName", "descriptionMD", "knowledgeGained[]"],
  },
  {
    model: "lesson",
    fields: ["name", "descriptionMD", "content"],
  },
  {
    model: "comment",
    fields: ["content"],
  },
  {
    model: "conversation",
    fields: [
      "conversationName",
      "course.courseName",
      "course.descriptionMD",
      "chatMember[].user.username",
      "chatMember[].user.firstName",
      "chatMember[].user.lastName",
      "chatMember[].user.email",
    ],
  },
  {
    model: "message",
    fields: ["content"],
  },
  {
    model: "attachment",
    fields: ["file.filename", "file.originalName", "file.mimetype"],
  },
  {
    model: "campaign",
    fields: ["name", "description"],
  },
] as { model: string; fields: string[] }[];

export const updateSearchAccent = async (model: string, id: string) => {
  const modelConfig = searchAccentMap.find((m) => m.model === model);
  if (!modelConfig) return null;

  const record = await (prisma[model] as any).findUnique({
    where: { id },
  });

  if (!record) return null;

  let searchAccent = "";

  for (const field of modelConfig.fields) {
    if (!field.includes("[") && !field.includes(".")) {
      const value = record[field];
      searchAccent += value ? removeAccent(String(value)) + " " : "";
    } else if (field.includes(".") && !field.includes("[")) {
      const [relationModel, relationField] = field.split(".");
      if (record[`${relationModel}Id`]) {
        const relatedRecord = await (prisma[relationModel] as any).findUnique({
          where: { id: record[`${relationModel}Id`] },
          select: { [relationField]: true },
        });
        if (relatedRecord) {
          searchAccent += relatedRecord?.[relationField]
            ? removeAccent(String(relatedRecord[relationField])) + " "
            : "";
        }
      }
    } else if (
      field.includes("[") &&
      field.includes("]") &&
      !field.includes(".")
    ) {
      const arrayField = field.replace(/\[\]/, "");
      const value = record[arrayField];
      searchAccent += value ? removeAccent(value.join("")) + " " : "";
    } else if (
      field.includes("[") &&
      field.includes("]") &&
      field.includes(".")
    ) {
      const arrayField = field.split("[].")[0];
      const nestedPath = field.split("[].")[1].split(".");
      const nestedKey = nestedPath.pop() as string;

      const relatedRecords = await (prisma[arrayField] as any).findMany({
        where: { [`${model}Id`]: id },
        include: {
          [nestedPath[0]]: true,
        },
      });

      const nestedValues = relatedRecords
        .map((record) => {
          let currentObj = record;
          const keys = nestedPath;
          keys.forEach((key) => {
            currentObj = currentObj[key];
          });

          return currentObj[nestedKey];
        })
        .filter((v) => v);

      searchAccent += nestedValues.length
        ? removeAccent(nestedValues.join("")) + " "
        : "";
    }
  }

  await (prisma[model] as any).update({
    where: { id },
    data: {
      searchAccent: removeAccent(searchAccent.trim()),
    },
  });
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

export const processRecords = (data) => {
  if (isArray(data)) {
    return data.map((item) => processRecords(item));
  }

  if (data && isObjectLike(data) && !isDate(data)) {
    const newData = cloneDeep(data);

    removeFields(newData, ["searchAccent", "deletedAt"]);

    Object.entries(newData).forEach(([key, value]) => {
      newData[key] = processRecords(value);
    });

    return newData;
  }

  return data;
};

const removeFields = (obj, fields) => {
  fields.forEach((field) => delete obj[field]);
};
