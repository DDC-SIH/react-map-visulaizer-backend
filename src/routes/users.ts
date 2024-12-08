// routes/users.ts
import express, { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { createUser, getUserByEmail } from "../services/UserService";
import verifyToken from "../middleware/auth";
import AWS from "aws-sdk";

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

export default router;
