// services/UserService.ts
import AWS from 'aws-sdk';
import bcrypt from 'bcryptjs';

AWS.config.update({
  region: process.env.AWS_REGION || 'ap-south-1', 
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = 'User';

export interface UserType {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isAuthorized?: boolean;
}

export async function createUser(user: UserType): Promise<void> {
  const hashedPassword = await bcrypt.hash(user.password, 8);
  const params = {
    TableName: USERS_TABLE,
    Item: {
      userId: user.email,
      email: user.email,
      password: hashedPassword,
      firstName: user.firstName,
      lastName: user.lastName,
      isAuthorized: user.isAuthorized || false,
    },
    Key: { userId: user.email },
  };

  await dynamodb.put(params).promise();
}

export async function getUserByEmail(email: string): Promise<UserType | null> {
  const params = {
    TableName: USERS_TABLE,
    Key: { userId:email },
  };

  const result = await dynamodb.get(params).promise();
  return result.Item as UserType | null;
}
