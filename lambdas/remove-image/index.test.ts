import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { S3, AWSError } from 'aws-sdk';
import { DeleteObjectOutput } from 'aws-sdk/clients/s3';
import { PromiseResult } from 'aws-sdk/lib/request';
import { handler, processS3Event } from './index';
import { S3Event } from 'aws-lambda';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockS3 = {
    deleteObject: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  return {
    S3: jest.fn(() => mockS3)
  };
});

let mockS3: jest.Mocked<S3>;
let mockDeleteObjectPromise: jest.Mock<Promise<PromiseResult<DeleteObjectOutput, AWSError>>>;

describe('remove-image Lambda Tests', () => {
  let mockContext: Context;

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
    mockS3 = new S3() as jest.Mocked<S3>;
    mockDeleteObjectPromise = jest.fn().mockResolvedValue({});
  });

  describe('processRecord', () => {
    const mockEvent: S3Event = {
      Records: [{
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'us-east-1',
        eventTime: '2024-01-01T00:00:00.000Z',
        eventName: 'ObjectCreated:Put',
        userIdentity: { principalId: 'test-principal' },
        requestParameters: { sourceIPAddress: '127.0.0.1' },
        responseElements: {
          'x-amz-request-id': 'test-request-id',
          'x-amz-id-2': 'test-id-2'
        },
        s3: {
          s3SchemaVersion: '1.0',
          configurationId: 'test-config',
          bucket: {
            name: 'test-bucket',
            ownerIdentity: { principalId: 'test-principal' },
            arn: 'arn:aws:s3:::test-bucket'
          },
          object: {
            key: 'test.jpg',
            size: 1000,
            eTag: 'test-etag',
            sequencer: 'test-sequencer'
          }
        }
      }]
    };

    beforeEach(() => {
      process.env.BUCKET_NAME = 'test-bucket';
      mockDeleteObjectPromise.mockResolvedValue({ $response: { data: {} } } as PromiseResult<DeleteObjectOutput, AWSError>);
    });

    it('should successfully delete a file from S3', async () => {
      await processS3Event(mockEvent);

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test.jpg',
      });
    });
  });

  describe('handler', () => {
    const mockContext: Context = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'test-arn',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: 'test-log-group',
      logStreamName: 'test-log-stream',
      getRemainingTimeInMillis: () => 1000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };

    beforeEach(() => {
      process.env.BUCKET_NAME = 'test-bucket';
      mockDeleteObjectPromise.mockResolvedValue({ $response: { data: {} } } as PromiseResult<DeleteObjectOutput, AWSError>);
    });

    it('should successfully process an S3 event', async () => {
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

      await handler(mockEvent, mockContext);

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test.jpg',
      });
    });
  });

  describe('processS3Event', () => {
    beforeEach(() => {
      process.env.BUCKET_NAME = 'test-bucket';
      mockS3 = new S3() as jest.Mocked<S3>;
      mockDeleteObjectPromise = jest.fn().mockResolvedValue({ $response: { data: {} } } as PromiseResult<DeleteObjectOutput, AWSError>);
      (mockS3.deleteObject().promise as jest.Mock) = mockDeleteObjectPromise;
    });

    it('should successfully delete a file from S3', async () => {
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

      await processS3Event(mockEvent);

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test.jpg',
      });
    });

    it('should throw an error if BUCKET_NAME is not set', async () => {
      delete process.env.BUCKET_NAME;
      const mockEvent: S3Event = {
        Records: []
      };

      await expect(processS3Event(mockEvent)).rejects.toThrow('BUCKET_NAME environment variable is not set');
    });

    it('should throw an error if S3 delete fails', async () => {
      mockDeleteObjectPromise.mockRejectedValue(new Error('Delete failed'));
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

      await expect(processS3Event(mockEvent)).rejects.toThrow('Delete failed');
    });
  });
}); 