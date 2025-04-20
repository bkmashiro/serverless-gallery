import { S3Event, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { ImageMetadata } from '../../shared/types';

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const lambda = new AWS.Lambda();

export const isValidImageType = (fileName: string): boolean => {
  const validExtensions = ['.jpeg', '.jpg', '.png'];
  return validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};

export const processS3Event = async (event: S3Event): Promise<void> => {
  console.log('=== Processing S3 Event ===');
  console.log('Event details:', JSON.stringify(event, null, 2));
  
  const TABLE_NAME = process.env.TABLE_NAME;
  console.log('Environment variables:');
  console.log('- TABLE_NAME:', TABLE_NAME);
  console.log('- AWS_REGION:', process.env.AWS_REGION);
  console.log('- AWS_LAMBDA_FUNCTION_NAME:', process.env.AWS_LAMBDA_FUNCTION_NAME);
  
  if (!TABLE_NAME) {
    console.error('TABLE_NAME environment variable is not set');
    throw new Error('TABLE_NAME environment variable is not set');
  }

  for (const record of event.Records) {
    const fileName = record.s3.object.key;
    console.log('\n=== Processing Record ===');
    console.log('File name:', fileName);
    console.log('S3 bucket:', record.s3.bucket.name);
    console.log('Event name:', record.eventName);
    console.log('Event time:', record.eventTime);
    
    if (!isValidImageType(fileName)) {
      console.error(`Invalid file type detected: ${fileName}`);
      // 调用 remove-image Lambda 函数删除无效文件
      try {
        await lambda.invoke({
          FunctionName: 'gallery-remove-image',
          InvocationType: 'Event',
          Payload: JSON.stringify({
            Records: [{
              s3: {
                bucket: {
                  name: record.s3.bucket.name
                },
                object: {
                  key: fileName
                }
              }
            }]
          })
        }).promise();
        console.log(`✅ Successfully triggered removal of invalid file: ${fileName}`);
      } catch (error) {
        console.error(`❌ Failed to trigger removal of invalid file ${fileName}:`, error);
      }
      continue;
    }

    const metadata: ImageMetadata = {
      id: fileName,
      metadata: {} // Initialize empty metadata object
    };

    console.log('\n=== Saving to DynamoDB ===');
    console.log('Table name:', TABLE_NAME);
    console.log('Metadata to save:', JSON.stringify(metadata, null, 2));
    
    try {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: metadata
      }).promise();
      console.log(`✅ Successfully logged image: ${fileName}`);
    } catch (error) {
      console.error(`❌ Failed to save metadata for file ${fileName}:`, error);
      throw error;
    }
  }
};

export const handler = async (event: S3Event, context: Context) => {
  console.log('=== Lambda Handler Started ===');
  console.log('Context:', JSON.stringify(context, null, 2));
  
  try {
    await processS3Event(event);
    
    console.log('=== Lambda Handler Completed Successfully ===');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully processed all images' })
    };
  } catch (error) {
    console.error('=== Lambda Handler Failed ===');
    console.error('Error details:', error);
    throw error;
  }
}; 