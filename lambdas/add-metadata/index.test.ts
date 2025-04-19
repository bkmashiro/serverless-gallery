import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { handler, processRecord } from './index';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockUpdate = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn().mockImplementation(() => ({
        update: mockUpdate
      }))
    }
  };
});

describe('add-metadata Lambda Tests', () => {
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
  });

  describe('processRecord', () => {
    const mockRecord: SQSRecord = {
      messageId: 'test-message-id',
      receiptHandle: 'test-receipt-handle',
      body: JSON.stringify({
        imageId: 'test-image.jpg',
        metadata: {
          title: 'Test Image',
          description: 'A test image',
          tags: ['test', 'image']
        }
      }),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1234567890',
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: '1234567890',
      },
      messageAttributes: {},
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'test-arn',
      awsRegion: 'us-east-1',
    };

    beforeEach(() => {
      process.env.TABLE_NAME = 'test-table';
    });

    it('should successfully update metadata for an image', async () => {
      await processRecord(mockRecord);

      expect(mockDynamoDB.update).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-image.jpg' },
        UpdateExpression: 'SET #metadata = :metadata',
        ExpressionAttributeNames: {
          '#metadata': 'metadata'
        },
        ExpressionAttributeValues: {
          ':metadata': {
            title: 'Test Image',
            description: 'A test image',
            tags: ['test', 'image']
          }
        },
        ConditionExpression: 'attribute_exists(id)'
      });
    });

    it('should throw error when TABLE_NAME is not set', async () => {
      delete process.env.TABLE_NAME;
      await expect(processRecord(mockRecord)).rejects.toThrow('TABLE_NAME environment variable is not set');
    });

    it('should throw error when imageId is missing', async () => {
      const invalidRecord = {
        ...mockRecord,
        body: JSON.stringify({
          metadata: {
            title: 'Test Image'
          }
        })
      };

      await expect(processRecord(invalidRecord as SQSRecord)).rejects.toThrow('Missing imageId in event');
    });

    it('should throw error when DynamoDB update fails', async () => {
      mockDynamoDB.update().promise.mockRejectedValueOnce(new Error('DynamoDB error'));

      await expect(processRecord(mockRecord)).rejects.toThrow('DynamoDB error');
    });
  });

  describe('handler', () => {
    const mockEvent: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-id',
          receiptHandle: 'test-receipt-handle',
          body: JSON.stringify({
            imageId: 'test-image.jpg',
            metadata: {
              title: 'Test Image',
              description: 'A test image',
              tags: ['test', 'image']
            }
          }),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890',
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'test-arn',
          awsRegion: 'us-east-1',
        }
      ]
    };

    beforeEach(() => {
      process.env.TABLE_NAME = 'test-table';
    });

    it('should successfully process all records', async () => {
      const result = await handler(mockEvent, mockContext);

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully updated all metadata' })
      });
    });

    it('should throw error when processing fails', async () => {
      mockDynamoDB.update().promise.mockRejectedValue(new Error('DynamoDB error'));

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('DynamoDB error');
    });
  });
}); 