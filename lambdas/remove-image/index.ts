import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { S3 } from 'aws-sdk';

const s3 = new S3();

interface S3EventRecord {
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
    };
  };
}

export const processRecord = async (record: SQSRecord): Promise<void> => {
  console.log('Processing record:', record.body);
  
  const BUCKET_NAME = process.env.BUCKET_NAME;
  if (!BUCKET_NAME) {
    console.error('BUCKET_NAME environment variable is not set');
    throw new Error('BUCKET_NAME environment variable is not set');
  }

  const s3Event = JSON.parse(record.body) as S3EventRecord;
  const fileName = s3Event.s3.object.key;

  console.log(`Attempting to delete file ${fileName} from bucket ${BUCKET_NAME}`);
  try {
    // Delete the invalid file from S3
    await s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: fileName
    }).promise();
    console.log(`Successfully removed invalid file: ${fileName}`);
  } catch (error) {
    console.error(`Failed to delete file ${fileName}:`, error);
    throw error;
  }
};

export const handler = async (event: SQSEvent, context: Context) => {
  console.log('Processing event:', JSON.stringify(event));
  try {
    await Promise.all(event.Records.map(processRecord));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully removed all invalid files' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 