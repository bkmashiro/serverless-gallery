import { SNSEvent, Context } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { ImageMetadata } from '../../shared/types';

const dynamodb = new DynamoDB.DocumentClient();

interface MetadataMessage {
  id: string;
  value: string;
}

export const processSNSMessage = async (message: string, attributes: any): Promise<void> => {
  console.log('Processing SNS message:', message);
  console.log('Message attributes:', attributes);
  
  const TABLE_NAME = process.env.TABLE_NAME;
  if (!TABLE_NAME) {
    console.error('TABLE_NAME environment variable is not set');
    throw new Error('TABLE_NAME environment variable is not set');
  }

  const metadataMessage = JSON.parse(message) as MetadataMessage;
  const { id, value } = metadataMessage;
  const metadataType = attributes.metadata_type?.StringValue;

  if (!id || !value || !metadataType) {
    console.error('Missing required fields in message');
    throw new Error('Missing required fields in message');
  }

  // 验证元数据类型
  const validTypes = ['Caption', 'Date', 'Name'];
  if (!validTypes.includes(metadataType)) {
    console.error(`Invalid metadata type: ${metadataType}`);
    throw new Error(`Invalid metadata type: ${metadataType}`);
  }

  console.log(`Updating ${metadataType} for image ${id}: ${value}`);
  try {
    // Update the metadata in DynamoDB
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: 'SET #metadata.#type = :value',
      ExpressionAttributeNames: {
        '#metadata': 'metadata',
        '#type': metadataType.toLowerCase()
      },
      ExpressionAttributeValues: {
        ':value': value
      },
      ConditionExpression: 'attribute_exists(id)' // Ensure the image exists
    }).promise();

    console.log(`Successfully updated ${metadataType} for image: ${id}`);
  } catch (error) {
    console.error(`Failed to update ${metadataType} for image ${id}:`, error);
    throw error;
  }
};

export const handler = async (event: SNSEvent, context: Context) => {
  console.log('Processing event:', JSON.stringify(event));
  try {
    for (const record of event.Records) {
      await processSNSMessage(record.Sns.Message, record.Sns.MessageAttributes);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully updated all metadata' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 