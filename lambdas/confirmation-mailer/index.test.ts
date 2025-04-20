import { SES } from 'aws-sdk';
import { handler, sendEmail, NotificationEvent } from './index';

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

  it('should send email with valid event', async () => {
    const validEvent: NotificationEvent = {
      imageId: 'test-image-1',
      status: 'approved',
      eventType: 'notification',
      notificationType: 'email'
    };

    const snsEvent = {
      Records: [{
        Sns: {
          Message: JSON.stringify(validEvent)
        }
      }]
    };

    await handler(snsEvent as any, {} as any);

    expect(mockSendEmail).toHaveBeenCalledWith({
      Destination: {
        ToAddresses: ['eda-lab-b@yuzhes.com']
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
      Source: 'eda-lab-a@yuzhes.com'
    });
  });

  it('should send email with custom recipient', async () => {
    const eventWithEmail: NotificationEvent = {
      imageId: 'test-image-2',
      status: 'rejected',
      email: 'custom@example.com',
      eventType: 'notification',
      notificationType: 'email'
    };

    const snsEvent = {
      Records: [{
        Sns: {
          Message: JSON.stringify(eventWithEmail)
        }
      }]
    };

    await handler(snsEvent as any, {} as any);

    expect(mockSendEmail).toHaveBeenCalledWith({
      Destination: {
        ToAddresses: ['custom@example.com']
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: expect.stringContaining('rejected')
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: expect.stringContaining('test-image-2')
        }
      },
      Source: 'eda-lab-a@yuzhes.com'
    });
  });

  it('should include reason in email when provided', async () => {
    const eventWithReason: NotificationEvent = {
      imageId: 'test-image-3',
      status: 'rejected',
      reason: 'Image quality is poor',
      eventType: 'notification',
      notificationType: 'email'
    };

    const snsEvent = {
      Records: [{
        Sns: {
          Message: JSON.stringify(eventWithReason)
        }
      }]
    };

    await handler(snsEvent as any, {} as any);

    expect(mockSendEmail).toHaveBeenCalledWith({
      Destination: {
        ToAddresses: ['eda-lab-b@yuzhes.com']
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: expect.stringContaining('Image quality is poor')
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: expect.stringContaining('test-image-3')
        }
      },
      Source: 'eda-lab-a@yuzhes.com'
    });
  });

  it('should handle SES send email errors', async () => {
    mockSendEmail.mockReturnValueOnce({
      promise: jest.fn().mockRejectedValue(new Error('SES error'))
    });

    const validEvent: NotificationEvent = {
      imageId: 'test-image-1',
      status: 'approved',
      eventType: 'notification',
      notificationType: 'email'
    };

    const snsEvent = {
      Records: [{
        Sns: {
          Message: JSON.stringify(validEvent)
        }
      }]
    };

    await expect(handler(snsEvent as any, {} as any)).rejects.toThrow('SES error');
  });
}); 