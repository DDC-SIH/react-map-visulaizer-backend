import express from 'express';
import AWS from 'aws-sdk';
import multer from 'multer';

interface ApiKey {
    apiKey: string;
    expired: boolean;
}

interface User {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    apiKeys: ApiKey[];
}

const router = express.Router();

// Use middleware to check for API key

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'ap-south-1'
});

const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient({
    region: process.env.AWS_REGION
});
const bucketName = process.env.S3_BUCKET_NAME || 'final-cog';

const upload = multer({ storage: multer.memoryStorage() });

router.get('/file/:fileName', async (req, res) => {
    const apiKey = req.query.key as string;
    const fileName = req.params.fileName;
    const range = req.headers.range;

    if (!apiKey) {
        return res.status(400).json({ message: 'API key is required as a query parameter' });
    }

    try {
        const params = {
            TableName: 'User',
            FilterExpression: 'contains(apiKeys, :keyObject)',
            ExpressionAttributeValues: {
                ':keyObject': {
                    apiKey: apiKey,
                    expired: false
                }
            }
        };

        const data = await dynamoDB.scan(params).promise();
        console.log('Retrieved data:', data); // For debugging

        if (!data.Items || data.Items.length === 0) {
            return res.status(403).json({ message: 'Invalid or expired API key' });
        }

        const user = data.Items[0] as User;
        const validKey = user.apiKeys.find(k => k.apiKey === apiKey && !k.expired);

        if (!validKey) {
            return res.status(403).json({ message: 'Invalid or expired API key' });
        }

        const s3Params = {
            Bucket: bucketName,
            Key: fileName
        };

        // Get file metadata first
        const metadata = await s3.headObject(s3Params).promise();
        const fileSize = metadata.ContentLength ?? 0;

        // Set common headers
        const headers = {
            'Content-Type': 'image/tiff',
            'Accept-Ranges': 'bytes',
            'Content-Length': fileSize
        };

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            res.writeHead(206, {
                ...headers,
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Content-Length': chunkSize
            });

            s3.getObject({
                ...s3Params,
                Range: `bytes=${start}-${end}`
            }).createReadStream().pipe(res);
        } else {
            // Send full file if no range is specified
            res.writeHead(200, headers);
            s3.getObject(s3Params).createReadStream().pipe(res);
        }
    } catch (error) {
        const errorMessage = (error as Error).message;
        console.error('Error:', error); // For debugging
        res.status(500).json({ message: 'Error downloading file', error: errorMessage });
    }
});

export default router;
