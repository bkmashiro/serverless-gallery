import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { DynamoDB, S3 } from 'aws-sdk';
import { ImageMetadata } from '../../shared/types';

const dynamodb = new DynamoDB.DocumentClient();
const s3 = new S3();

interface S3EventRecord {
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
      eTag: string;
    };
  };
}

export const isValidImageType = (fileName: string): boolean => {
  const validExtensions = ['.jpeg', '.jpg', '.png'];
  return validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};

export const processRecord = async (record: SQSRecord): Promise<void> => {
  console.log('Processing record:', record.body);
  
  const TABLE_NAME = process.env.TABLE_NAME;
  if (!TABLE_NAME) {
    console.error('TABLE_NAME environment variable is not set');
    throw new Error('TABLE_NAME environment variable is not set');
  }

  const s3Event = JSON.parse(record.body) as S3EventRecord;
  const fileName = s3Event.s3.object.key;
  
  if (!isValidImageType(fileName)) {
    console.error(`Invalid file type detected: ${fileName}`);
    throw new Error(`Invalid file type: ${fileName}`);
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
};

export const handler = async (event: SQSEvent, context: Context) => {
  console.log('Processing event:', JSON.stringify(event));
  try {
    await Promise.all(event.Records.map(processRecord));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully processed all images' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 