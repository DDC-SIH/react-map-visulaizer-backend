// routes/users.ts
import express, { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { createUser, getUserByEmail } from "../services/UserService";
import verifyToken from "../middleware/auth";
import AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";
import * as archiver from "archiver";

const router = express.Router();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

router.post(
  "/register",
  [
    check("firstName", "First Name is required").isString(),
    check("lastName", "Last Name is required").isString(),
    check("email", "Email is required").isEmail(),
    check("password", "Password with 6 or more characters required").isLength({
      min: 6,
    }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }

    const { email, password, firstName, lastName } = req.body;

    try {
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "User with the provided email already exists" });
      }

      await createUser({
        email,
        password,
        firstName,
        lastName,
        isAuthorized: false,
      });

      const token = jwt.sign(
        { userId: email },
        process.env.JWT_SECRET_KEY as string,
        { expiresIn: "1d" }
      );
      console.log(token);
      res.cookie("map_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 86400000,
      });
      return res.status(200).json({
        userId: email,
        token,
        message: "User Registered successfully",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Something is wrong" });
    }
  }
);

router.get("/me", verifyToken, async (req: Request, res: Response) => {
  const userId = req.userId;

  try {
    const params = {
      TableName: "User",
      Key: { userId: userId },
    };

    const result = await dynamoDb.get(params).promise();

    if (!result.Item) {
      return res.status(400).json({ message: "User not found" });
    }

    res.json(result.Item);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post(
  "/addDownload",
  verifyToken,
  async (req: Request, res: Response) => {
    const userId = req.userId;
    const { downloadObject } = req.body;

    if (!downloadObject) {
      return res.status(400).json({ message: "downloadObject is required" });
    }

    try {
      const params = {
        TableName: "User",
        Key: { userId },
        UpdateExpression:
          "SET #downloads = list_append(if_not_exists(#downloads, :empty_list), :download)",
        ExpressionAttributeNames: {
          "#downloads": "downloads", 
        },
        ExpressionAttributeValues: {
          ":download": [
            {
              downloadDateTime: new Date().toISOString(), 
              isAuthorized: false,
              downloadObject,
            },
          ],
          ":empty_list": [], 
        },
        ReturnValues: "UPDATED_NEW", 
      };

      const result = await dynamoDb.update(params).promise();

      res.json({
        message: "Download added successfully",
        updatedDownloads: result.Attributes?.downloads,
      });
    } catch (error) {
      console.error("Error adding download:", error);
      res.status(500).json({ message: "Something went wrong", error });
    }
  }
);


router.get("/downloadZip", verifyToken, async (req: Request, res: Response) => {
  const userId = req.userId;
  const { downloadDateTime } = req.query;

  if (!downloadDateTime) {
    return res.status(400).json({ message: "downloadDateTime is required" });
  }

  try {
    // Fetch the user data
    const params = {
      TableName: "User",
      Key: { userId },
    };

    const result = await dynamoDb.get(params).promise();

    if (!result.Item || !result.Item.downloads) {
      return res.status(404).json({ message: "No downloads found for this user" });
    }

    // Find the download object by downloadDateTime
    const downloadObject = result.Item.downloads.find(
      (download: any) => download.downloadDateTime === downloadDateTime
    );

    if (!downloadObject) {
      return res.status(404).json({ message: "Download object not found for the provided date" });
    }

    // Create a temporary zip file stream
    const zip = archiver("zip", { zlib: { level: 9 } });
    const zipFileName = `${userId}_${downloadDateTime}.zip`;
    const zipStream = fs.createWriteStream(path.join(__dirname, zipFileName));

    // Pipe the archive data to the file
    zip.pipe(zipStream);

    // Loop through selected bands and add files to zip
    for (const date in downloadObject.downloadObject.selectedBands) {
      const selectedBand = downloadObject.downloadObject.selectedBands[date];
      for (const resolution in selectedBand) {
        const fileUrl = selectedBand[resolution];
        const fileName = path.basename(fileUrl);

        // Download file from S3 and append to the zip
        const s3Params = { Bucket: fileUrl.split("/")[2], Key: fileUrl.split("/").slice(3).join("/") };
        const s3Object = await s3.getObject(s3Params).promise();
        
        zip.append(s3Object.Body, { name: fileName });
      }
    }

    // Finalize the zip
    zip.finalize();

    // Wait for the zip file to be created
    zipStream.on("close", () => {
      res.download(path.join(__dirname, zipFileName), zipFileName, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error downloading the zip file", error: err });
        }

        // Optionally delete the zip file after download
        fs.unlinkSync(path.join(__dirname, zipFileName));
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong", error });
  }
});

export default router;
