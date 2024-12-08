import express from "express";
import AWS from "aws-sdk";

const router = express.Router();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

type AOI = {
    north: number;
    south: number;
    east: number;
    west: number;
    created: string;
    coordinateSystem: string;
    units: string;
};

type Effects = {
    arithmatic: string;
    colormap: string;
    min: number;
    max: number;
    steps: number;
};

type Polygon = {
    type: string;
    geometry: {
        type: string;
        coordinates: number[][][];
    };
    properties: {
        created: string;
        area: number;
        coordinateSystem: string;
        units: string;
    };
};

type Urls = string[];

router.post("/order/custom", async (req, res) => {
    let aoi: AOI, effects: Effects, polygon: Polygon, urls: Urls;
    aoi = {
        "north": 57.6537,
        "south": 13.7796,
        "east": 85.0627,
        "west": 35.7095,
        "created": "2024-12-08T06:11:13.583Z",
        "coordinateSystem": "EPSG:4326",
        "units": "degrees"
    }
    effects = {
        "arithmatic": "ndvi",
        "colormap": "virdis",
        "min": 0,
        "max": 1,
        "steps": 20
    }
    polygon =
    {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [
                        75.07585328696811,
                        33.77208678135719
                    ],
                    [
                        93.4575738180095,
                        29.0646335026415
                    ],
                    [
                        77.03753705330361,
                        8.79571253740302
                    ],
                    [
                        75.07585328696811,
                        33.77208678135719
                    ]
                ]
            ]
        },
        "properties": {
            "created": "2024-12-08T05:59:59.744Z",
            "area": 224.43460023655686,
            "coordinateSystem": "EPSG:4326",
            "units": "degrees"
        }
    }

    urls = [
        "https://final-cog.s3.ap-south-1.amazonaws.com/L1C/2021-10-01/1.tif",
        "https://final-cog.s3.ap-south-1.amazonaws.com/L1C/2021-10-01/2.tif",
        "https://final-cog.s3.ap-south-1.amazonaws.com/L1C/2021-10-01/3.tif"
    ]

    try {
     //Invoke Lambda
    } catch (error: any) {
        res.status(500).json({ error: "Could not load item: " + error.message });
    }
});


export default router;