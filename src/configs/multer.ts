import multer from "multer";
import { createWriteStream, existsSync, mkdirSync, statSync } from "fs";
import path from "path";
import axios from "axios";
import prisma from "../prisma";
import { lookup } from "mime-types";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    mkdirSync("uploads/", { recursive: true });
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = file.originalname.split(".").pop();
      cb(null, `file-${uniqueSuffix}.${extension}`);
    } catch (e) {
      console.log(e);
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `file-${uniqueSuffix}`);
    }
  },
});

const KGBUploader = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb: any) => {
    cb(null, true);
  },
});

const downloadImage = async (url: string, userId: string) => {
  const uploadsDir = "./uploads";
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const extension = "jpg";
  const filename = `file-${uniqueSuffix}.${extension}`;
  const filepath = path.join(uploadsDir, filename);

  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    const writer = createWriteStream(filepath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
    const mimetype = lookup(filepath);

    const data = {
      fieldname: "file",
      originalname: path.basename(url),
      encoding: "7bit",
      mimetype: mimetype || "application/octet-stream",
      destination: uploadsDir,
      filename: filename,
      path: filepath,
      size: statSync(filepath).size,
    };
    const file = await prisma.file.create({
      data: {
        filename: filename,
        localPath: `uploads/${filename}`,
        filesize: String(data.size),
        mimetype: data.mimetype,
        originalName: data.originalname,
        owner: {
          connect: {
            id: userId,
          },
        },
      },
    });
    return file;
  } catch (error) {
    console.log(error);

    return null;
  }
};

export { KGBUploader, downloadImage };
