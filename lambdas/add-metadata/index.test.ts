import { SNSEvent, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { handler, processSNSMessage } from './index';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockUpdate = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  
  const mockGet = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({
      Item: {
        id: 'test-image.jpg',
        metadata: {}
      }
    })
  });
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn().mockImplementation(() => ({
        update: mockUpdate,
        get: mockGet
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
    mockDynamoDB = new AWS.DynamoDB.DocumentClient();

    // Setup environment variables
    process.env.TABLE_NAME = 'test-table';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TABLE_NAME;
  });

  describe('processSNSMessage', () => {
    const mockMessage = JSON.stringify({
      id: 'test-image.jpg',
      value: 'Test Caption'
    });

    const mockAttributes = {
      metadata_type: {
        Value: 'Caption'
      }
    };

    it('should successfully update metadata for an image', async () => {
      await processSNSMessage(mockMessage, mockAttributes);

      expect(mockDynamoDB.update).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-image.jpg' },
        UpdateExpression: 'SET #metadata.#type = :value',
        ExpressionAttributeNames: {
          '#metadata': 'metadata',
          '#type': 'caption'
        },
        ExpressionAttributeValues: {
          ':value': 'Test Caption'
        },
        ReturnValues: 'ALL_NEW'
      });
    });
  });

  describe('handler', () => {
    const mockEvent: SNSEvent = {
      Records: [
        {
          EventSource: 'aws:sns',
          EventVersion: '1.0',
          EventSubscriptionArn: 'test-arn',
          Sns: {
            Type: 'Notification',
            MessageId: 'test-message-id',
            TopicArn: 'test-topic-arn',
            Subject: 'Test Subject',
            Message: JSON.stringify({
              id: 'test-image.jpg',
              value: 'Test Caption'
            }),
            Timestamp: '2024-01-01T00:00:00.000Z',
            SignatureVersion: '1',
            Signature: 'test-signature',
            SigningCertUrl: 'test-cert-url',
            UnsubscribeUrl: 'test-unsubscribe-url',
            MessageAttributes: {
              metadata_type: {
                Type: 'String',
                Value: 'Caption'
              }
            }
          }
        }
      ]
    };

    it('should successfully process all records', async () => {
      const result = await handler(mockEvent, mockContext);

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully updated all metadata' })
      });
    });
  });
}); 