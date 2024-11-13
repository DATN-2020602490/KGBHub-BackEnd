import { NextFunction } from 'express';
import { File, KGBRequest, KGBResponse } from '../global';
import prisma from '../configs/prisma';
import getVideoDurationInSeconds from 'get-video-duration';
import { isArray } from 'lodash';
import { KGBUploader } from '../configs/multer';

// export const processFile = async (req: KGBRequest, res: KGBResponse, next: NextFunction) => {
//   if (req.file) {
//     const file = req.file
//     let duration = 0
//     try {
//       duration = await getVideoDurationInSeconds(file.path)
//     } catch (e) {}
//     const fileModel = await prisma.file.create({
//       data: {
//         filename: file.filename,
//         mimetype: file.mimetype,
//         filesize: String(file.size),
//         localPath: file.path,
//         originalName: file.originalname,
//         duration: duration,
//         owner: {
//           connect: {
//             id: req.user.id,
//           },
//         },
//       },
//     })
//     req.fileModel = fileModel as File
//   } else if (req.files) {
//     if (isArray(req.files)) {
//       const files = req.files as Express.Multer.File[]
//       const fileModels = (await Promise.all(
//         files.map(async (file): Promise<File> => {
//           let duration = 0
//           try {
//             duration = await getVideoDurationInSeconds(file.path)
//           } catch (e) {}
//           const { id } = await prisma.file.create({
//             data: {
//               filename: file.filename,
//               mimetype: file.mimetype,
//               filesize: String(file.size),
//               localPath: file.path,
//               originalName: file.originalname,
//               duration: duration,
//               owner: {
//                 connect: {
//                   id: req.user.id,
//                 },
//               },
//             },
//           })
//           return (await prisma.file.findUnique({ where: { id }, include: { owner: true } })) as File
//         }),
//       )) as any
//       req.fileModels = fileModels
//     } else {
//       const _files = req.files as { [fieldname: string]: Express.Multer.File[] }
//       req.fileModels = {}
//       for (const key in _files) {
//         const files = _files[key]
//         for (const file of files) {
//           let duration = 0
//           try {
//             duration = await getVideoDurationInSeconds(file.path)
//           } catch (e) {}
//           const { id } = await prisma.file.create({
//             data: {
//               filename: file.filename,
//               mimetype: file.mimetype,
//               filesize: String(file.size),
//               localPath: file.path,
//               originalName: file.originalname,
//               duration: duration,
//               owner: {
//                 connect: {
//                   id: req.user.id,
//                 },
//               },
//             },
//           })
//           const fileModel = (await prisma.file.findUnique({ where: { id }, include: { owner: true } })) as File
//           if (req.fileModels[key]) {
//             req.fileModels[key].push(fileModel)
//           } else {
//             req.fileModels[key] = [fileModel]
//           }
//         }
//       }
//     }
//   }
//   next()
// }

const createFileModel = async (file: Express.Multer.File, userId: string): Promise<File> => {
  let duration = 0;
  try {
    duration = await getVideoDurationInSeconds(file.path);
  } catch (e) {}

  const { id } = await prisma.file.create({
    data: {
      filename: file.filename,
      mimetype: file.mimetype,
      filesize: String(file.size),
      localPath: file.path,
      originalName: file.originalname,
      duration: duration,
      owner: { connect: { id: userId } },
    },
  });
  return (await prisma.file.findUnique({ where: { id }, include: { owner: true } })) as File;
};

const processFile = async (req: KGBRequest, res: KGBResponse, next: NextFunction) => {
  const userId = req.user.id;
  if (req.file) {
    req.fileModel = await createFileModel(req.file, userId);
  } else if (req.files) {
    if (isArray(req.files)) {
      req.fileModels = await Promise.all(
        (req.files as Express.Multer.File[]).map((file) => createFileModel(file, userId)),
      );
    } else {
      const fileModelsWithFieldName: { [fieldname: string]: File[] } = {};
      for (const key in req.files as { [fieldname: string]: Express.Multer.File[] }) {
        fileModelsWithFieldName[key] = await Promise.all(
          (req.files[key] as Express.Multer.File[]).map((file) => createFileModel(file, userId)),
        );
      }
      req.fileModelsWithFieldName = fileModelsWithFieldName;
    }
  }
  next();
};

export const fileMiddleware =
  (fields: { name: string; maxCount?: number }[]) => (req: KGBRequest, res: KGBResponse, next: NextFunction) => {
    KGBUploader.fields(fields)(req, res, (err) => {
      if (err) {
        return next(err);
      }
      processFile(req, res, next);
    });
  };
