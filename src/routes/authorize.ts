import express, { Request, Response } from 'express';
import AWS from 'aws-sdk';
import multer from 'multer';
import { DynamoDB } from 'aws-sdk';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import verifyToken from '../middleware/auth';

const router = express.Router();
const s3 = new AWS.S3();
const dynamoDb = new DynamoDB.DocumentClient();

// Set up multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// DynamoDB Table Name
const authorizationTableName = 'Authorization';
const tableName = 'Authorization';
const userTableName = 'User'; 

// Route for submitting the request
router.post('/submit-request', verifyToken, upload.single('file'), async (req, res) => {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  
    const { dataSource, category, profileCategory, message } = req.body;
    const file = req.file;
  
    if (!file || !dataSource || !category || !profileCategory || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    try {
      // Retrieve user details from the User table
      const userParams: DocumentClient.GetItemInput = {
        TableName: userTableName,
        Key: { userId: req.userId },
      };
  
      const userData = await dynamoDb.get(userParams).promise();
      if (!userData.Item) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const { firstName, lastName, email } = userData.Item;
  
      // Generate a unique partition key
      const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
      // Upload file to S3
      const fileName = `${uniqueId}-${file.originalname}`;
      const params = {
        Bucket: 'final-cog',
        Key: `AuthorizationFiles/${fileName}`,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
  
      // Upload the file to S3
      const uploadData = await s3.upload(params).promise();
      const fileUrl = uploadData.Location;
  
      // Prepare data for DynamoDB
      const dbParams: DocumentClient.PutItemInput = {
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
          firstName,
          lastName,
          email,
          userId: req.userId, // Store userId as part of the request for reference
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

// PUT route for updating the status of an authorization request
router.put('/update-status/:uniqueId', async (req, res) => {
  const { uniqueId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required.' });
  }

  try {
    // Step 1: Get the email from the Authorization table using uniqueId
    const authorizationParams: DocumentClient.GetItemInput = {
      TableName: authorizationTableName,
      Key: { uniqueId },
    };

    const authorizationData = await dynamoDb.get(authorizationParams).promise();
    if (!authorizationData.Item) {
      return res.status(404).json({ message: 'Authorization request not found.' });
    }

    const { email } = authorizationData.Item;

    // Step 2: Find the user by email in the User table
    const userParams: DocumentClient.GetItemInput = {
      TableName: userTableName,
      Key: { userId:email },
    };

    const userData = await dynamoDb.get(userParams).promise();
    if (!userData.Item) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Step 3: Update the user's isAuthorized status based on the provided status
    const isAuthorized = status === 'ACCEPTED';

    const updateUserParams: DocumentClient.UpdateItemInput = {
      TableName: userTableName,
      Key: { userId:email },  // We use email to update the user
      UpdateExpression: 'set #isAuthorized = :isAuthorized',
      ExpressionAttributeNames: {
        '#isAuthorized': 'isAuthorized',
      },
      ExpressionAttributeValues: {
        ':isAuthorized': isAuthorized,
      },
      ReturnValues: 'ALL_NEW',
    };

    await dynamoDb.update(updateUserParams).promise();

    // Step 4: Update the status in the Authorization table
    const authorizationUpdateParams: DocumentClient.UpdateItemInput = {
      TableName: authorizationTableName,
      Key: { uniqueId },
      UpdateExpression: 'set #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDb.update(authorizationUpdateParams).promise();

    return res.status(200).json({ message: 'Status updated successfully', updatedItem: result.Attributes });
  } catch (error:any) {
    console.error('Error updating status:', error);
    return res.status(500).json({ message: 'Failed to update status', error: error.message });
  }
});


export default router;