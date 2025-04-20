import { S3Event, Context } from 'aws-lambda';
import { S3 } from 'aws-sdk';

const s3 = new S3();

export const processS3Event = async (event: S3Event): Promise<void> => {
  console.log('Processing S3 event:', JSON.stringify(event));
  
  const BUCKET_NAME = process.env.BUCKET_NAME;
  if (!BUCKET_NAME) {
    console.error('BUCKET_NAME environment variable is not set');
    throw new Error('BUCKET_NAME environment variable is not set');
  }

  for (const record of event.Records) {
    const fileName = record.s3.object.key;

    console.log(`Attempting to delete file ${fileName} from bucket ${BUCKET_NAME}`);
    try {
      // Delete the file from S3
      await s3.deleteObject({
        Bucket: BUCKET_NAME,
        Key: fileName
      }).promise();
      console.log(`Successfully removed file: ${fileName}`);
    } catch (error) {
      console.error(`Failed to delete file ${fileName}:`, error);
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
      body: JSON.stringify({ message: 'Successfully removed all files' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 