import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { ImageMetadata } from '../../shared/types';

const dynamodb = new DynamoDB.DocumentClient();

interface MetadataUpdateEvent {
  imageId: string;
  metadata: Partial<ImageMetadata>;
}

export const processRecord = async (record: SQSRecord): Promise<void> => {
  console.log('Processing record:', record.body);
  
  const TABLE_NAME = process.env.TABLE_NAME;
  if (!TABLE_NAME) {
    console.error('TABLE_NAME environment variable is not set');
    throw new Error('TABLE_NAME environment variable is not set');
  }

  const event = JSON.parse(record.body) as MetadataUpdateEvent;
  const { imageId, metadata } = event;

  if (!imageId) {
    console.error('Missing imageId in event');
    throw new Error('Missing imageId in event');
  }

  console.log(`Updating metadata for image ${imageId}:`, metadata);
  try {
    // Update the metadata in DynamoDB
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: { id: imageId },
      UpdateExpression: 'SET #metadata = :metadata',
      ExpressionAttributeNames: {
        '#metadata': 'metadata'
      },
      ExpressionAttributeValues: {
        ':metadata': metadata
      },
      ConditionExpression: 'attribute_exists(id)' // Ensure the image exists
    }).promise();

    console.log(`Successfully updated metadata for image: ${imageId}`);
  } catch (error) {
    console.error(`Failed to update metadata for image ${imageId}:`, error);
    throw error;
  }
};

export const handler = async (event: SQSEvent, context: Context) => {
  console.log('Processing event:', JSON.stringify(event));
  try {
    await Promise.all(event.Records.map(processRecord));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully updated all metadata' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 