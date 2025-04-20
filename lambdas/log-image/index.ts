import { S3Event, Context } from 'aws-lambda';
import { DynamoDB, S3 } from 'aws-sdk';
import { ImageMetadata } from '../../shared/types';

const dynamodb = new DynamoDB.DocumentClient();
const s3 = new S3();

export const isValidImageType = (fileName: string): boolean => {
  const validExtensions = ['.jpeg', '.jpg', '.png'];
  return validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};

export const processS3Event = async (event: S3Event): Promise<void> => {
  console.log('Processing S3 event:', JSON.stringify(event));
  
  const TABLE_NAME = process.env.TABLE_NAME;
  if (!TABLE_NAME) {
    console.error('TABLE_NAME environment variable is not set');
    throw new Error('TABLE_NAME environment variable is not set');
  }

  for (const record of event.Records) {
    const fileName = record.s3.object.key;
    
    if (!isValidImageType(fileName)) {
      console.error(`Invalid file type detected: ${fileName}`);
      continue;
    }

    const metadata: ImageMetadata = {
      id: fileName,
      // Initial metadata will be updated later via SNS
    };

    console.log(`Attempting to save metadata for file ${fileName} to table ${TABLE_NAME}`);
    try {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: metadata,
        ConditionExpression: 'attribute_not_exists(id)', // Prevent overwriting existing images
      }).promise();
      console.log(`Successfully logged image: ${fileName}`);
    } catch (error) {
      console.error(`Failed to save metadata for file ${fileName}:`, error);
      throw error;
    }
  }
};

export const handler = async (event: S3Event, context: Context) => {
  console.log('Processing event:', JSON.stringify(event));
  try {
    await processS3Event(event);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully processed all images' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 