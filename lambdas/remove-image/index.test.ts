import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { handler, processRecord } from './index';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockDeleteObject = jest.fn().mockReturnValue({
    promise: jest.fn()
  });
  const mockS3 = {
    deleteObject: mockDeleteObject
  };
  return {
    S3: jest.fn(() => mockS3),
  };
});

describe('remove-image Lambda Tests', () => {
  let mockContext: Context;
  let mockS3: any;
  let mockDeleteObjectPromise: jest.Mock;

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

    // Setup mock S3
    mockS3 = new S3();
    mockDeleteObjectPromise = mockS3.deleteObject().promise;
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
      process.env.BUCKET_NAME = 'test-bucket';
      mockDeleteObjectPromise.mockResolvedValue({});
    });

    it('should successfully delete a file from S3', async () => {
      await processRecord(mockRecord);

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test.jpg',
      });
    });

    it('should throw error when BUCKET_NAME is not set', async () => {
      delete process.env.BUCKET_NAME;
      await expect(processRecord(mockRecord)).rejects.toThrow('BUCKET_NAME environment variable is not set');
    });

    it('should throw error when S3 deletion fails', async () => {
      mockDeleteObjectPromise.mockRejectedValueOnce(new Error('S3 deletion error'));

      await expect(processRecord(mockRecord)).rejects.toThrow('S3 deletion error');
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
      process.env.BUCKET_NAME = 'test-bucket';
      mockDeleteObjectPromise.mockResolvedValue({});
    });

    it('should successfully process all records', async () => {
      const result = await handler(mockEvent, mockContext);

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully removed all invalid files' }),
      });
    });

    it('should throw error when processing fails', async () => {
      mockDeleteObjectPromise.mockRejectedValueOnce(new Error('S3 deletion error'));

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('S3 deletion error');
    });
  });
}); 