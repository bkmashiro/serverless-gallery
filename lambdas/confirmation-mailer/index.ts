import { SNSEvent, Context } from 'aws-lambda';
import { SES } from 'aws-sdk';
import { SES_REGION, SES_EMAIL_FROM, SES_EMAIL_TO } from '../../env';

const ses = new SES({ region: SES_REGION });

export interface NotificationEvent {
  imageId: string;
  status: 'approved' | 'rejected';
  email?: string;
  reason?: string;
  eventType: 'notification';
  notificationType: 'email';
}

export const sendEmail = async (event: NotificationEvent): Promise<void> => {
  console.log('Sending email notification:', event);

  const { imageId, status, reason } = event;
  const email = event.email || SES_EMAIL_TO;

  const subject = `Your image ${imageId} has been ${status}`;
  const body = `
    <html>
      <body>
        <h2>Image Review Status Update</h2>
        <p>Your image "${imageId}" has been ${status}.</p>
        ${reason ? `<p>Reason: ${reason}</p>` : ''}
        <p>Thank you for using our service.</p>
      </body>
    </html>
  `;

  try {
    console.log(`Sending email to ${email}`);
    
    const params: SES.SendEmailRequest = {
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: body
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: subject
        }
      },
      Source: SES_EMAIL_FROM
    };

    await ses.sendEmail(params).promise();
    console.log(`Successfully sent email to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw error;
  }
};

export const handler = async (event: SNSEvent, context: Context) => {
  console.log('Processing event:', JSON.stringify(event));

  try {
    const records = event.Records.map(record => JSON.parse(record.Sns.Message) as NotificationEvent);
    await Promise.all(records.map(sendEmail));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully sent all emails' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 