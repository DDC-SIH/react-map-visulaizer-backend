import express from 'express';
import AWS from 'aws-sdk';

const router = express.Router();
const dynamoDb = new AWS.DynamoDB.DocumentClient();
function getMonthShortName(month: string): string {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthNames[parseInt(month, 10) - 1];
}

router.get('/', async (req, res) => {
    const params = {
        TableName: 'Files'
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        res.json(data.Items);
    } catch (error:any) {
        res.status(500).json({ error: 'Could not load items: ' + error.message });
    }
});

router.get('/:id', async (req, res) => {
    const params = {
        TableName: 'Files',
        Key: {
            Unique_Id: req.params.id
        }
    };
    
    try {
        const data = await dynamoDb.get(params).promise();
        if (data.Item) {
            res.json(data.Item);
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    } catch (error:any) {
        res.status(500).json({ error: 'Could not load item: ' + error.message });
    }
});

router.post('/grouped', async (req, res) => {
    const params = {
        TableName: 'Files'
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        const items = data.Items || [];

        const groupedData = items.reduce((acc: any, item: any) => {
            item.HDF_Product_File_Name = item.HDF_Product_File_Name.replace('.h5', '');
            const parts = item.HDF_Product_File_Name.split('_');
            const prefix = parts[0];
            const captureDate = parts[1];
            const captureTime = parts[2];
            const dataProcessingLevel = parts[3];
            const standard = parts[4];
            const version = parts[parts.length-1].substring(1, 3);

            const groupName = `${prefix}_${dataProcessingLevel}_${standard}`;
            const dateTime = new Date(`${captureDate} ${captureTime.slice(0, 2)}:${captureTime.slice(2)}`);

            if (!acc[groupName]) {
                acc[groupName] = {
                    GroupName: groupName,
                    StartDateTime: dateTime,
                    EndDateTime: dateTime,
                    Versions: [version]
                };
            } else {
                acc[groupName].StartDateTime = new Date(Math.min(acc[groupName].StartDateTime.getTime(), dateTime.getTime()));
                acc[groupName].EndDateTime = new Date(Math.max(acc[groupName].EndDateTime.getTime(), dateTime.getTime()));
                if (!acc[groupName].Versions.includes(version)) {
                    acc[groupName].Versions.push(version);
                }
            }

            return acc;
        }, {});
        res.json(Object.values(groupedData));
    } catch (error: any) {
        res.status(500).json({ error: 'Could not load grouped items: ' + error.message });
    }
});

router.post('/search', async (req, res) => {
    const { prefix, dataProcessingLevel, standard, version } = req.body;
    const params = {
        TableName: 'Files',
        FilterExpression: 'contains(HDF_Product_File_Name, :prefix) and contains(HDF_Product_File_Name, :dataProcessingLevel) and contains(HDF_Product_File_Name, :standard) and contains(HDF_Product_File_Name, :version)',
        ExpressionAttributeValues: {
            ':prefix': prefix,
            ':dataProcessingLevel': dataProcessingLevel,
            ':standard': standard,
            ':version': version
        }
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        const items = data.Items || [];

        if (items.length === 0) {
            return res.json([]);
        }

        const commonAttributes = Object.keys(items[0]).reduce((acc: { [key: string]: any }, key) => {
            if (items.every(item => item[key] === items[0][key])) {
                acc[key] = items[0][key];
            }
            return acc;
        }, {});

        res.json({ items, commonAttributes });
    } catch (error: any) {
        res.status(500).json({ error: 'Could not search items: ' + error.message });
    }
});

router.post('/deep-search', async (req, res) => {
    const { prefix, dataProcessingLevel, standard, version, startDate, endDate } = req.body;
    console.log(req.body)
    const params = {
        TableName: 'Files',
        FilterExpression: 'contains(HDF_Product_File_Name, :prefix) and contains(HDF_Product_File_Name, :dataProcessingLevel) and contains(HDF_Product_File_Name, :standard) and contains(HDF_Product_File_Name, :version)',
        ExpressionAttributeValues: {
            ':prefix': prefix,
            ':dataProcessingLevel': dataProcessingLevel,
            ':standard': standard,
            ':version': version
        }
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        const items = data.Items || [];
        const filteredItems = items.filter(item => {
            const parts = item.HDF_Product_File_Name.split('_');
            console.log(item.HDF_Product_File_Name)
            const captureDate = parts[1];
            const captureTime = parts[2];
            const dateTime = new Date(`${captureDate} ${captureTime.slice(0, 2)}:${captureTime.slice(2)}`);

            const newStartDateTime  = `${startDate.slice(6,8)}${getMonthShortName(startDate.slice(4,6))}${startDate.slice(0,4)} ${startDate.slice(8,10)}:${startDate.slice(10,12)}`
            const newEndDateTime = `${endDate.slice(6,8)}${getMonthShortName(endDate.slice(4,6))}${endDate.slice(0,4)} ${endDate.slice(8,10)}:${endDate.slice(10,12)}`
            
            
            return dateTime >= new Date(`${newStartDateTime}`) && dateTime <= new Date(newEndDateTime);
        });

        if (filteredItems.length === 0) {
            console.log("empty")
            return res.json([]);
        }

        // const commonAttributes = Object.keys(filteredItems[0]).reduce((acc: { [key: string]: any }, key) => {
        //     if (filteredItems.every(item => item[key] === filteredItems[0][key])) {
        //         acc[key] = filteredItems[0][key];
        //     }
        //     return acc;
        // }, {});
        res.json(filteredItems);
    } catch (error: any) {
        res.status(500).json({ error: 'Could not search items: ' + error.message });
    }
});

export default router;