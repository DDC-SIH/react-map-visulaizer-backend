import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import AWS from 'aws-sdk';
import verifyToken from '../middleware/auth';

const router = express.Router();
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = 'User';

interface ApiKey {
    apiKey: string;
    name: string;
    expired: boolean;
    status: 'ACTIVE' | 'INACTIVE';
    validTill: string; // ISO string
}

interface User {
    userId: string;
    apiKeys?: ApiKey[];
}



// Route to generate an API Key
router.post('/generate', verifyToken, async (req: Request, res: Response) => {
    const { apiName } = req.body;

    if (!apiName) {
        return res.status(400).json({ message: 'API name is required.' });
    }

    const newApiKey: ApiKey = {
        apiKey: uuidv4(),
        name: apiName,
        expired: false,
        status: 'ACTIVE',
        validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };

    try {
        const params = {
            TableName: USERS_TABLE,
            Key: { userId: req.userId },
            UpdateExpression: 'SET apiKeys = list_append(if_not_exists(apiKeys, :emptyList), :newKey)',
            ExpressionAttributeValues: {
                ':emptyList': [],
                ':newKey': [newApiKey],
            },
            ReturnValues: 'ALL_NEW',
        };

        const result = await dynamoDb.update(params).promise();
        res.status(201).json({ message: 'API Key generated successfully.', apiKeys: result.Attributes?.apiKeys });
    } catch (error) {
        console.error('Error generating API Key:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route to toggle API Key status
router.put('/toggle', verifyToken, async (req: Request, res: Response) => {
    const { apiKey } = req.body;

    if (!apiKey) {
        return res.status(400).json({ message: 'API Key is required.' });
    }

    try {
        const getUserParams = {
            TableName: USERS_TABLE,
            Key: { userId: req.userId },
        };

        const user = await dynamoDb.get(getUserParams).promise();

        if (!user.Item) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const updatedKeys = (user.Item.apiKeys as ApiKey[]).map((key) => {
            if (key.apiKey === apiKey) {
                return { ...key, status: key.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' };
            }
            return key;
        });

        const updateParams = {
            TableName: USERS_TABLE,
            Key: { userId: req.userId },
            UpdateExpression: 'SET apiKeys = :updatedKeys',
            ExpressionAttributeValues: { ':updatedKeys': updatedKeys },
            ReturnValues: 'ALL_NEW',
        };

        const result = await dynamoDb.update(updateParams).promise();
        res.status(200).json({ message: 'API Key status toggled.', apiKeys: result.Attributes?.apiKeys });
    } catch (error) {
        console.error('Error toggling API Key status:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route to get all API keys
router.get('/all', verifyToken, async (req: Request, res: Response) => {
    try {
      const params = {
        TableName: USERS_TABLE,
        Key: { userId: req.userId },
      };
  
      const user = await dynamoDb.get(params).promise();
  
      if (!user.Item) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      res.status(200).json({ apiKeys: user.Item.apiKeys || [] });
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

export default router;
