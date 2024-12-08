import express, { NextFunction, Request, Response } from 'express';
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
import getFilesRoutes from './routes/getFiles';

// AWS Configuration
AWS.config.update({
  region: process.env.AWS_REGION,           
  accessKeyId: process.env.AWS_ACCESS_KEY,   
  secretAccessKey: process.env.AWS_SECRET_KEY 
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();  
process.env.AWS_SDK_LOAD_CONFIG = '1'; // Suppress AWS SDK warnings
process.emitWarning = () => {}; // Suppress all warnings

const app = express();
const PORT = process.env.PORT || 7000;

// Middleware to log requests and responses
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const skipLogging = ['/api/auth/validate-token', '/validate-token'];

  if (!skipLogging.includes(req.url)) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (!skipLogging.includes(req.url)) {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`
      );
    }
  });

  next();
});

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
app.use("/api/get-files", getFilesRoutes);

app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
