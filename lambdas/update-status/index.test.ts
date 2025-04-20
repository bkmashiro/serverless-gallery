import { DynamoDB } from 'aws-sdk';
import { Context, SNSEvent } from 'aws-lambda';
import { handler, processRecord, StatusUpdateEvent } from './index';

// Mock AWS SDK and Date
jest.mock('aws-sdk', () => {
  const mockUpdate = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        update: mockUpdate
      }))
    }
  };
});

// Mock Date.now() to return a fixed timestamp
const mockDate = new Date('2025-04-20T20:15:56.795Z');
global.Date = jest.fn(() => mockDate) as any;
global.Date.now = jest.fn(() => mockDate.getTime());

describe('update-status Lambda Tests', () => {
  let mockContext: Context;
  let mockDynamoDB: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock context
    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:region:account-id:function:test-function',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: 'test-log-group',
      logStreamName: 'test-log-stream',
      getRemainingTimeInMillis: jest.fn(),
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // Setup mock DynamoDB
    mockDynamoDB = new DynamoDB.DocumentClient();

    // Setup environment variables
    process.env.TABLE_NAME = 'test-table';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TABLE_NAME;
  });

  describe('processRecord', () => {
    const mockRecord: StatusUpdateEvent = {
      imageId: 'test-image-1',
      status: 'approved',
      eventType: 'status_update'
    };

    it('should successfully update status for an image', async () => {
      await processRecord(mockRecord);

      expect(mockDynamoDB.update).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-image-1' },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: {
          ':status': 'approved',
          ':updatedAt': '2025-04-20T20:15:56.795Z'
        }
      });
    });
  });

  describe('handler', () => {
    const mockEvent: SNSEvent = {
      Records: [
        {
          EventVersion: '1.0',
          EventSubscriptionArn: 'test-arn',
          EventSource: 'aws:sns',
          Sns: {
            Type: 'Notification',
            MessageId: 'test-message-id',
            TopicArn: 'test-topic-arn',
            Subject: 'Test Subject',
            Message: JSON.stringify({
              imageId: 'test-image-1',
              status: 'approved',
              eventType: 'status_update'
            }),
            Timestamp: '2024-01-01T00:00:00.000Z',
            SignatureVersion: '1',
            Signature: 'test-signature',
            SigningCertUrl: 'test-cert-url',
            UnsubscribeUrl: 'test-unsubscribe-url',
            MessageAttributes: {}
          }
        }
      ]
    };

    it('should successfully process all records', async () => {
      const result = await handler(mockEvent, mockContext);

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully processed all records' })
      });
    });
  });
}); 