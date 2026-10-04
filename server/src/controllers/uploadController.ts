

// export const uploadImage: RequestHandler = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ message: "No file provided" });
//   }

//   // Narrow to a local const and assert the Multer file type
//   const file = req.file as Express.Multer.File;

//   try {
//     const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
//       const stream = cloudinary.uploader.upload_stream(
//         { folder: "jomu-mart/products" },
//         (error, result) => {
//           if (error || !result) return reject(error);
//           resolve(result);
//         }
//       );
//       stream.end(file.buffer);
//     });

//     return res.json({ url: result.secure_url });
//   } catch (error) {
//     console.error("Upload error:", error);
//     return res.status(500).json({ message: "Failed to upload image" });
//   }
// };


import { Response } from 'express'
// import type { AuthRequest } from '../middleware/authMiddleware'

// export const uploadImage = async (req: Request, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: 'No file provided' })
//     }

//     const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
//       const stream = cloudinary.uploader.upload_stream(
//         { folder: 'jomu-mart/products' },
//         (error, result) => {
//           if (error || !result) return reject(error)
//           resolve(result)
//         }
//       )
//       stream.end(req.file!.buffer)
//     })

//     res.json({ url: result.secure_url })
//   } catch (error) {
//     console.error(error)
//     res.status(500).json({ message: 'Failed to upload image' })
//   }
// }

import { RequestHandler } from "express";
import cloudinary from "../lib/cloudinary";

export const uploadImage: RequestHandler = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file provided" });
  }

  // Narrow to a local const and assert the Multer file type
  const file = req.file as Express.Multer.File;

  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "jomu-mart/products" },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    return res.json({ url: result.secure_url });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Failed to upload image" });
  }
};



