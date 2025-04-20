import { SNSEvent, Context } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();

export interface StatusUpdateEvent {
  imageId: string;
  status: 'approved' | 'rejected';
  reason?: string;
  eventType: 'status_update';
}

export const processRecord = async (record: StatusUpdateEvent): Promise<void> => {
  console.log('Processing record:', record);

  const { imageId, status, reason } = record;

  const params: DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: process.env.TABLE_NAME!,
    Key: { id: imageId },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    },
  };

  if (reason) {
    params.UpdateExpression += ', #reason = :reason';
    params.ExpressionAttributeNames!['#reason'] = 'reason';
    params.ExpressionAttributeValues![':reason'] = reason;
  }

  try {
    await dynamoDb.update(params).promise();
    console.log(`Successfully updated status for image ${imageId} to ${status}`);
  } catch (error) {
    console.error(`Error updating status for image ${imageId}:`, error);
    throw error;
  }
};

export const handler = async (event: SNSEvent, context: Context) => {
  console.log('Processing event:', JSON.stringify(event));

  try {
    const records = event.Records.map(record => JSON.parse(record.Sns.Message) as StatusUpdateEvent);
    await Promise.all(records.map(processRecord));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully processed all records' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 