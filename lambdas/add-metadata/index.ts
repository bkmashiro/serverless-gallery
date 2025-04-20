import { SNSEvent, Context } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { ImageMetadata } from '../../shared/types';

const dynamodb = new DynamoDB.DocumentClient();

interface MetadataMessage {
  id: string;
  value: string;
}

export const processSNSMessage = async (message: string, attributes: any): Promise<void> => {
  console.log('=== Processing SNS Message ===');
  console.log('Message:', message);
  console.log('Message attributes:', JSON.stringify(attributes, null, 2));
  
  const TABLE_NAME = process.env.TABLE_NAME;
  console.log('Environment variables:');
  console.log('- TABLE_NAME:', TABLE_NAME);
  console.log('- AWS_REGION:', process.env.AWS_REGION);
  console.log('- AWS_LAMBDA_FUNCTION_NAME:', process.env.AWS_LAMBDA_FUNCTION_NAME);
  
  if (!TABLE_NAME) {
    console.error('TABLE_NAME environment variable is not set');
    throw new Error('TABLE_NAME environment variable is not set');
  }

  const metadataMessage = JSON.parse(message) as MetadataMessage;
  const { id, value } = metadataMessage;
  const metadataType = attributes.metadata_type?.Value;

  console.log('\n=== Parsed Message ===');
  console.log('Image ID:', id);
  console.log('Value:', value);
  console.log('Metadata Type:', metadataType);

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

  console.log('\n=== Updating DynamoDB ===');
  console.log(`Updating ${metadataType} for image ${id}: ${value}`);
  
  // 首先检查记录是否存在
  try {
    const getResult = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { id }
    }).promise();
    
    console.log('Existing record:', JSON.stringify(getResult.Item, null, 2));
    
    if (!getResult.Item) {
      console.error(`Image ${id} not found in table ${TABLE_NAME}`);
      throw new Error(`Image ${id} not found in table ${TABLE_NAME}`);
    }
  } catch (error) {
    console.error(`Failed to check if image ${id} exists:`, error);
    throw error;
  }

  try {
    // Update the metadata in DynamoDB
    const updateParams = {
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
      ReturnValues: 'ALL_NEW'
    };
    
    console.log('Update parameters:', JSON.stringify(updateParams, null, 2));
    
    const result = await dynamodb.update(updateParams).promise();
    console.log('Update result:', JSON.stringify(result, null, 2));
    console.log(`✅ Successfully updated ${metadataType} for image: ${id}`);
  } catch (error) {
    console.error(`❌ Failed to update ${metadataType} for image ${id}:`, error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
};

export const handler = async (event: SNSEvent, context: Context) => {
  console.log('=== Lambda Handler Started ===');
  console.log('Context:', JSON.stringify(context, null, 2));
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    for (const record of event.Records) {
      await processSNSMessage(record.Sns.Message, record.Sns.MessageAttributes);
    }
    
    console.log('=== Lambda Handler Completed Successfully ===');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully updated all metadata' })
    };
  } catch (error) {
    console.error('=== Lambda Handler Failed ===');
    console.error('Error details:', error);
    throw error;
  }
}; 