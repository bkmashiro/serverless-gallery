import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { DynamoDB, S3 } from 'aws-sdk';
import { handler, isValidImageType, processRecord } from './index';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockPut = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  const mockDynamoDB = {
    put: mockPut
  };
  const mockS3 = {};
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDynamoDB),
    },
    S3: jest.fn(() => mockS3),
  };
});

describe('log-image Lambda Tests', () => {
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

  describe('isValidImageType', () => {
    it('should return true for valid image types', () => {
      expect(isValidImageType('test.jpg')).toBe(true);
      expect(isValidImageType('test.jpeg')).toBe(true);
      expect(isValidImageType('test.png')).toBe(true);
    });

    it('should return false for invalid image types', () => {
      expect(isValidImageType('test.txt')).toBe(false);
      expect(isValidImageType('test.pdf')).toBe(false);
      expect(isValidImageType('test')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isValidImageType('test.JPG')).toBe(true);
      expect(isValidImageType('test.JPEG')).toBe(true);
      expect(isValidImageType('test.PNG')).toBe(true);
    });
  });

  describe('processRecord', () => {
    const mockRecord: SQSRecord = {
      messageId: 'test-message-id',
      receiptHandle: 'test-receipt-handle',
      body: JSON.stringify({
        s3: {
          bucket: {
            name: 'test-bucket',
          },
          object: {
            key: 'test.jpg',
            size: 1000,
            eTag: 'test-etag',
          },
        },
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

    it('should successfully process a valid image record', async () => {
      await processRecord(mockRecord);

      expect(mockDynamoDB.put).toHaveBeenCalledWith({
        TableName: 'test-table',
        Item: {
          id: 'test.jpg',
        },
        ConditionExpression: 'attribute_not_exists(id)',
      });
    });

    it('should throw error for invalid file type', async () => {
      const invalidRecord = {
        ...mockRecord,
        body: JSON.stringify({
          s3: {
            bucket: {
              name: 'test-bucket',
            },
            object: {
              key: 'test.txt',
              size: 1000,
              eTag: 'test-etag',
            },
          },
        }),
      };

      await expect(processRecord(invalidRecord as SQSRecord)).rejects.toThrow('Invalid file type: test.txt');
    });

    it('should throw error when TABLE_NAME is not set', async () => {
      delete process.env.TABLE_NAME;
      await expect(processRecord(mockRecord)).rejects.toThrow('TABLE_NAME environment variable is not set');
    });
  });

  describe('handler', () => {
    const mockEvent: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-id',
          receiptHandle: 'test-receipt-handle',
          body: JSON.stringify({
            s3: {
              bucket: {
                name: 'test-bucket',
              },
              object: {
                key: 'test.jpg',
                size: 1000,
                eTag: 'test-etag',
              },
            },
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
        },
      ],
    };

    beforeEach(() => {
      process.env.TABLE_NAME = 'test-table';
    });

    it('should successfully process all records', async () => {
      const result = await handler(mockEvent, mockContext);

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully processed all images' }),
      });
    });

    it('should throw error when processing fails', async () => {
      mockDynamoDB.put().promise.mockRejectedValue(new Error('DynamoDB error'));

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('DynamoDB error');
    });
  });
}); 