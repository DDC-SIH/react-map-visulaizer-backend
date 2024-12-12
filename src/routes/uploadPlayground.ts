import express, { Request, Response } from 'express';
import multer from 'multer';
import { S3 } from 'aws-sdk';

const router = express.Router();

// Initialize S3 (assuming it is already configured)
const s3 = new S3();
const bucketName = 'kdg-raw';

// Multer configuration to handle file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Files are stored in memory
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/tiff') {
      cb(null, true);
    } else {
      cb(new Error('Only .tif files are allowed!'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // Limit file size to 10MB
});

// Route to upload a TIF file
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { originalname, buffer } = req.file;

    const uploadParams = {
      Bucket: bucketName,
      Key: originalname, // Use original file name as key
      Body: buffer,
      ContentType: 'image/tiff',
    };

    const result = await s3.upload(uploadParams).promise();
    res.status(200).json({ message: 'File uploaded successfully', data: result });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file', error });
  }
});

export default router;
