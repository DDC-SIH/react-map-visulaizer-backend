import express, { NextFunction, Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
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
import authorizeRoutes from './routes/authorize';
import apiKeysRouter from './routes/apiKeysRouter';
import hdfUploadRouter from './routes/hdf5uploadrouter';
import uploadPlayground from './routes/uploadPlayground';

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

// Log the environment variables for debugging
console.log('FRONTEND_URL_LOCAL:', process.env.FRONTEND_URL_LOCAL);
console.log('FRONTEND_URL_PROD:', process.env.FRONTEND_URL_PROD);
console.log('FRONTEND_URL_PROD 2:', process.env.FRONTEND_URL_PROD2);
console.log('FRONTEND_URL_PROD 3:', process.env.FRONTEND_URL_PROD3);

// Allow specific origins
const allowedOrigins = [
  process.env.FRONTEND_URL_LOCAL,
  process.env.FRONTEND_URL_PROD,
  process.env.FRONTEND_URL_PROD2,
  process.env.FRONTEND_URL_PROD3,
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Origin not allowed by CORS:', origin);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // Enable credentials if needed
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
};

// Use CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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



app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/files", metadataRoutes);
app.use("/api/get-files", getFilesRoutes);
app.use("/api/authorize", authorizeRoutes);
app.use('/api/keys', apiKeysRouter);
app.use('/api/hdf', hdfUploadRouter);
app.use('/api/upload-tif', uploadPlayground);

app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
