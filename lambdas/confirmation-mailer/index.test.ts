import { SES } from 'aws-sdk';
import { handler } from './index';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockSendEmail = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });

  return {
    SES: jest.fn(() => ({
      sendEmail: mockSendEmail
    }))
  };
});

describe('Confirmation Mailer Lambda', () => {
  let mockSendEmail: jest.Mock;
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    mockSendEmail = ((SES as unknown) as jest.Mock)().sendEmail;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('should send email with valid DynamoDB record', async () => {
    const dynamoDbEvent = {
      Records: [{
        eventName: 'MODIFY',
        dynamodb: {
          NewImage: {
            id: { S: 'test-image-1' },
            status: { S: 'approved' }
          }
        }
      }]
    };

    await handler(dynamoDbEvent as any, {} as any);

    expect(mockSendEmail).toHaveBeenCalledWith({
      Destination: {
        ToAddresses: ['20108862@mail.wit.ie']
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: expect.stringContaining('approved')
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: expect.stringContaining('test-image-1')
        }
      },
      Source: '20108862@mail.wit.ie'
    });
  });

  it('should skip non-MODIFY events', async () => {
    const dynamoDbEvent = {
      Records: [{
        eventName: 'INSERT',
        dynamodb: {
          NewImage: {
            id: { S: 'test-image-1' },
            status: { S: 'approved' }
          }
        }
      }]
    };

    await handler(dynamoDbEvent as any, {} as any);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
}); 