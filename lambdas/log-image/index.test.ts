import { S3Event, Context } from 'aws-lambda';
import { DynamoDB, S3, Lambda } from 'aws-sdk';
import { handler, isValidImageType, processS3Event } from './index';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockPut = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  const mockInvoke = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  const mockDynamoDB = {
    put: mockPut
  };
  const mockS3 = {};
  const mockLambda = {
    invoke: mockInvoke
  };
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDynamoDB),
    },
    S3: jest.fn(() => mockS3),
    Lambda: jest.fn(() => mockLambda)
  };
});

describe('log-image Lambda Tests', () => {
  let mockContext: Context;
  let mockDynamoDB: any;
  let mockLambda: any;

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

    // Setup mock DynamoDB and Lambda
    mockDynamoDB = new DynamoDB.DocumentClient();
    mockLambda = new Lambda();
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

  describe('processS3Event', () => {
    const mockEvent: S3Event = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'us-east-1',
          eventTime: '2024-01-01T00:00:00.000Z',
          eventName: 'ObjectCreated:Put',
          userIdentity: {
            principalId: 'test-principal'
          },
          requestParameters: {
            sourceIPAddress: '127.0.0.1'
          },
          responseElements: {
            'x-amz-request-id': 'test-request-id',
            'x-amz-id-2': 'test-id-2'
          },
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: 'test-config',
            bucket: {
              name: 'test-bucket',
              ownerIdentity: {
                principalId: 'test-principal'
              },
              arn: 'arn:aws:s3:::test-bucket'
            },
            object: {
              key: 'test.jpg',
              size: 1000,
              eTag: 'test-etag',
              sequencer: 'test-sequencer'
            }
          }
        }
      ]
    };

    beforeEach(() => {
      process.env.TABLE_NAME = 'test-table';
    });

    it('should successfully process a valid image record', async () => {
      await processS3Event(mockEvent);

      expect(mockDynamoDB.put).toHaveBeenCalledWith({
        TableName: 'test-table',
        Item: {
          id: 'test.jpg',
          metadata: {}
        }
      });
    });

    it('should trigger remove-image Lambda for invalid file type', async () => {
      const invalidEvent = {
        ...mockEvent,
        Records: [{
          ...mockEvent.Records[0],
          s3: {
            ...mockEvent.Records[0].s3,
            object: {
              ...mockEvent.Records[0].s3.object,
              key: 'test.txt'
            }
          }
        }]
      };

      await processS3Event(invalidEvent);

      expect(mockLambda.invoke).toHaveBeenCalledWith({
        FunctionName: 'gallery-remove-image',
        InvocationType: 'Event',
        Payload: JSON.stringify({
          Records: [{
            s3: {
              bucket: {
                name: 'test-bucket'
              },
              object: {
                key: 'test.txt'
              }
            }
          }]
        })
      });
    });
  });

  describe('handler', () => {
    const mockEvent: S3Event = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'us-east-1',
          eventTime: '2024-01-01T00:00:00.000Z',
          eventName: 'ObjectCreated:Put',
          userIdentity: {
            principalId: 'test-principal'
          },
          requestParameters: {
            sourceIPAddress: '127.0.0.1'
          },
          responseElements: {
            'x-amz-request-id': 'test-request-id',
            'x-amz-id-2': 'test-id-2'
          },
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: 'test-config',
            bucket: {
              name: 'test-bucket',
              ownerIdentity: {
                principalId: 'test-principal'
              },
              arn: 'arn:aws:s3:::test-bucket'
            },
            object: {
              key: 'test.jpg',
              size: 1000,
              eTag: 'test-etag',
              sequencer: 'test-sequencer'
            }
          }
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
        body: JSON.stringify({ message: 'Successfully processed all images' })
      });
    });
  });
}); 