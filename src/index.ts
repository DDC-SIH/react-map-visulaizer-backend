import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import AWS from 'aws-sdk';
import cookieParser from 'cookie-parser';
import path from 'path';

// Routes
import userRoutes from './routes/users';
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import metadataRoutes from './routes/metadata';

// AWS Configuration
AWS.config.update({
  region: process.env.AWS_REGION,           
  accessKeyId: process.env.AWS_ACCESS_KEY,   
  secretAccessKey: process.env.AWS_SECRET_KEY 
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();  

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/files", metadataRoutes);

app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
