import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import AWS from "aws-sdk";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      isAuthorized: boolean;
    }
  }
}

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token =
    req.cookies["auth_token"] || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
    const userEmail = (decoded as JwtPayload).userId;
    const dynamoDb = new AWS.DynamoDB.DocumentClient();

    const params = {
      TableName: "User",
      Key: {
        userId: userEmail,
      },
    };

    dynamoDb.get(params, (err, data) => {
      if (err || !data.Item) {
        return res.status(401).json({ message: "unauthorized" });
      }
      
      req.isAuthorized = data.Item.isAuthorized || false;
      req.userId = userEmail;
      next();
    });
  } catch (error) {
    return res.status(401).json({ message: "unauthorized" });
  }
};

export default verifyToken;
