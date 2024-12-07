import express from "express";
import AWS from "aws-sdk";

const router = express.Router();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

router.get("/all", async (req, res) => {
  const tables = ["L1B", "L2B", "L1C", "L2C"];
  const groupedItems: { [key: string]: any[] } = {};

  try {
    for (const table of tables) {
      const params = {
        TableName: table,
      };
      const data = await dynamoDb.scan(params).promise();
      if (data.Items) {
        groupedItems[table] = data.Items;
      } else {
        groupedItems[table] = [];
      }
    }
    res.json(groupedItems);
  } catch (error: any) {
    res.status(500).json({ error: "Could not load items: " + error.message });
  }
});

router.get("/table/:table", async (req, res) => {
  const { table } = req.params;
  const params = {
    TableName: table,
  };

  try {
    const data = await dynamoDb.scan(params).promise();
    if (data.Items) {
      res.json(data.Items);
    } else {
      res.json([]);
    }
  } catch (error: any) {
    res.status(500).json({ error: "Could not load items: " + error.message });
  }
});

router.get("/table/:table/:date", async (req, res) => {
  const { table, date } = req.params;
  const params = {
    TableName: table,
    Key: {
      date,
    },
  };

  try {
    const data = await dynamoDb.get(params).promise();
    if (data.Item) {
      res.json(data.Item);
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Could not load item: " + error.message });
  }
});

router.post("/search", async (req, res) => {
  const { startDate, endDate, processingLevel } = req.body;
  if (new Date(startDate) > new Date(endDate)) {
    return res
      .status(400)
      .json({ error: "startDate must be less than or equal to endDate" });
  }

  const params = {
    TableName: processingLevel,
  };

  try {
    const data = await dynamoDb.scan(params).promise();
    if (data.Items) {
      const filteredItems = data.Items.filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
      });
      res.json(filteredItems);
    } else {
      res.json([]);
    }
  } catch (error: any) {
    res.status(500).json({ error: "Could not load items: " + error.message });
  }
});

router.post("/searchWithTime", async (req, res) => {
  const { startDate, endDate, processingLevel } = req.body;

  // Parse and validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return res
      .status(400)
      .json({ error: "startDate must be less than or equal to endDate" });
  }

  const params = {
    TableName: processingLevel,
  };

  try {
    // Fetch data from DynamoDB
    const data = await dynamoDb.scan(params).promise();
    if (!data.Items || data.Items.length === 0) {
      return res.json({});
    }

    // Process and filter items
    const result: { [key: string]: { [key: string]: any } } = {};
    data.Items.forEach((item) => {
      const itemDate = new Date(item.date);

      // Check if the item's date falls within the range
      const filteredTimes = {};
      item.time.forEach((timeEntry: any) => {
        Object.entries(timeEntry).forEach(([timeKey, mainData]) => {
          const timeDate = new Date(
            `${item.date} ${timeKey.slice(0, 2)}:${timeKey.slice(2)}`
          );

          // Check if the time falls within the range
          if (timeDate >= start && timeDate <= end) {
            if (!result[item.date]) {
              result[item.date] = {};
            }
            result[item.date][timeKey] = mainData;
          }
        });
      });
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching or processing data:", error);
    res.status(500).json({ error: "Could not load items: " + error.message });
  }
});

router.post("/getItem", async (req, res) => {
  const { processingLevel, dateTime } = req.body;
  
  const dateObj = new Date(dateTime);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
  const year = dateObj.getFullYear();
  const date = `${day}${month}${year}`;
  const time = new Date(dateTime).toLocaleTimeString('en-GB', { hour12: false }).replace(":", "").slice(0, 4);
  console.log(date, time);
  const params = {
    TableName: processingLevel,
    Key: {
      date,
    },
  };
  
  try {
    const data = await dynamoDb.get(params).promise();
    if (data.Item) {
      const item = data.Item;
      const timeEntry = item.time.find((entry: any) => entry[time]);
      if (timeEntry) {
        res.json(timeEntry[time]);
      } else {
        res.status(404).json({ error: "Time entry not found" });
      }
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Could not load item: " + error.message });
  }
});


export default router;