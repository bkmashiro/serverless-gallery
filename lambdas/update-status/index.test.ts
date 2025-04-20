import { DynamoDB } from 'aws-sdk';
import { handler, processRecord, StatusUpdateEvent } from './index';

// Mock AWS SDK
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

describe('Update Status Lambda', () => {
  let mockUpdate: jest.Mock;
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, TABLE_NAME: 'test-table' };
    mockUpdate = (DynamoDB.DocumentClient as jest.Mock)().update;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('should process a valid status update', async () => {
    const validEvent: StatusUpdateEvent = {
      imageId: 'test-image-1',
      status: 'approved',
      eventType: 'status_update'
    };

    const snsEvent = {
      Records: [{
        Sns: {
          Message: JSON.stringify(validEvent)
        }
      }]
    };

    await handler(snsEvent as any, {} as any);

    expect(mockUpdate).toHaveBeenCalledWith({
      TableName: 'test-table',
      Key: { id: 'test-image-1' },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':status': 'approved',
        ':updatedAt': expect.any(String)
      }
    });
  });

  it('should process a status update with reason', async () => {
    const eventWithReason: StatusUpdateEvent = {
      imageId: 'test-image-2',
      status: 'rejected',
      reason: 'Image quality is poor',
      eventType: 'status_update'
    };

    const snsEvent = {
      Records: [{
        Sns: {
          Message: JSON.stringify(eventWithReason)
        }
      }]
    };

    await handler(snsEvent as any, {} as any);

    expect(mockUpdate).toHaveBeenCalledWith({
      TableName: 'test-table',
      Key: { id: 'test-image-2' },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #reason = :reason',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#reason': 'reason'
      },
      ExpressionAttributeValues: {
        ':status': 'rejected',
        ':updatedAt': expect.any(String),
        ':reason': 'Image quality is poor'
      }
    });
  });

  it('should throw error when TABLE_NAME is not set', async () => {
    process.env.TABLE_NAME = undefined;
    const validEvent: StatusUpdateEvent = {
      imageId: 'test-image-1',
      status: 'approved',
      eventType: 'status_update'
    };

    const snsEvent = {
      Records: [{
        Sns: {
          Message: JSON.stringify(validEvent)
        }
      }]
    };

    await expect(handler(snsEvent as any, {} as any)).rejects.toThrow();
  });

  it('should handle DynamoDB update errors', async () => {
    mockUpdate.mockReturnValueOnce({
      promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
    });

    const validEvent: StatusUpdateEvent = {
      imageId: 'test-image-1',
      status: 'approved',
      eventType: 'status_update'
    };

    const snsEvent = {
      Records: [{
        Sns: {
          Message: JSON.stringify(validEvent)
        }
      }]
    };

    await expect(handler(snsEvent as any, {} as any)).rejects.toThrow('DynamoDB error');
  });
}); 