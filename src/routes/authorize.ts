import express, { Request, Response } from 'express';
import AWS from 'aws-sdk';
import multer from 'multer';
import { DynamoDB } from 'aws-sdk';

const router = express.Router();
const s3 = new AWS.S3();
const dynamoDb = new DynamoDB.DocumentClient();

// Set up multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// DynamoDB Table Name
const tableName = 'Authorization';

// Route for submitting the request
router.post('/submit-request', upload.single('file'), async (req, res) => {
  const { dataSource, category, profileCategory, message } = req.body;
  const file = req.file;

  if (!file || !dataSource || !category || !profileCategory || !message) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Generate a unique partition key
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Upload file to S3
    const fileName = `${uniqueId}-${file.originalname}`;
    const params = {
      Bucket: 'final-cog',
      Key: `AuthorizationFiles/${fileName}`,
      Body: file.buffer,
      ContentType: file.mimetype,
    //   ACL: 'public-read', 
    };

    // Upload the file to S3
    const uploadData = await s3.upload(params).promise();
    const fileUrl = uploadData.Location;

    // Prepare data for DynamoDB
    const dbParams = {
      TableName: tableName,
      Item: {
        uniqueId,
        fileUrl,
        dataSource,
        category,
        profileCategory,
        message,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      },
    };

    // Store data in DynamoDB
    await dynamoDb.put(dbParams).promise();

    // Respond with success and file URL
    res.status(200).json({ message: 'Request submitted successfully', fileUrl });
  } catch (error) {
    console.error('Error during file upload or database operation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/all', async (req: Request, res: Response) => {
    try {
      const params = {
        TableName: tableName,
      };
  
      const result = await dynamoDb.scan(params).promise();
  
      res.status(200).json({ items: result.Items });
    } catch (error) {
      console.error('Error fetching items:', error);
      res.status(500).json({ message: 'Error fetching items', error });
    }
  });


  


export default router;