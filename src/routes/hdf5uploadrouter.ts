import express, { Request, Response } from "express";
import AWS from "aws-sdk";
import multer from "multer";
import fs from "fs";
import path from "path";
import util from "util";

const router = express.Router();
const s3 = new AWS.S3({
  region: 'ap-south-1',
});

// Middleware for file upload
const upload = multer({ dest: "uploads/" });

// Generate Presigned URL
router.get("/presigned-url", async (req: Request, res: Response) => {
  const { fileName } = req.query;

  if (!fileName) {
    return res.status(400).send("File name is required.");
  }

  const params = {
    Bucket: process.env.HDF_S3_BUCKET_NAME as string || 'kdg-raw' ,
    Key: `uploads/${fileName}`,
    Expires: 3600,
    ContentType: 'application/octet-stream',
  };
  

  try {
    const url = await s3.getSignedUrlPromise("putObject", params);
    res.json({ url });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).send("Could not generate presigned URL.");
  }
});

// Multipart Upload
router.post("/multipart-upload", upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("File is required.");
  }

  const uploadParams = {
    Bucket: process.env.HDF_S3_BUCKET_NAME || 'kdg-raw',
    Key: encodeURIComponent(`uploads/${file.originalname}`),
    ContentType: "application/x-hdf",
  };

  try {
    // Initialize multipart upload
    const multipartUpload = await s3.createMultipartUpload(uploadParams).promise();
    const uploadId = multipartUpload.UploadId!;

    const fileStream = fs.createReadStream(file.path);
    const fileSize = fs.statSync(file.path).size;
    const partSize = 5 * 1024 * 1024; // 5MB per part
    const totalParts = Math.ceil(fileSize / partSize);

    const parts = [];
    for (let i = 0; i < totalParts; i++) {
      const start = i * partSize;
      const end = Math.min(start + partSize, fileSize);

      const partBuffer = fs.readFileSync(file.path).slice(start, end);
      const partUpload = s3.uploadPart({
        Body: partBuffer,
        Bucket: uploadParams.Bucket,
        Key: uploadParams.Key,
        PartNumber: i + 1,
        UploadId: uploadId!,
      }).promise();

      parts.push(partUpload);
    }

    // Complete multipart upload
    const completedParts = (await Promise.all(parts)).map((part, index) => ({
      ETag: part.ETag!,
      PartNumber: index + 1,
    }));

    const completionParams = {
      Bucket: uploadParams.Bucket,
      Key: uploadParams.Key,
      MultipartUpload: {
        Parts: completedParts,
      },
      UploadId: uploadId,
    };

    if (!uploadId) {
      throw new Error("UploadId is undefined");
    }
    await s3.completeMultipartUpload(completionParams).promise();
    res.status(200).send("File uploaded successfully.");
  } catch (error) {
    console.error("Error during multipart upload:", error);
    res.status(500).send("Upload failed.");
  } finally {
    fs.unlinkSync(file.path); // Clean up the temp file
  }
});

export default router;
