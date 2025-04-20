import { DynamoDBStreamEvent, Context } from 'aws-lambda';
import { SES } from 'aws-sdk';
import { SES_REGION, SES_EMAIL_FROM, SES_EMAIL_TO } from '../../env';

const ses = new SES({ region: SES_REGION });

export const sendEmail = async (record: DynamoDBStreamEvent['Records'][0]): Promise<void> => {
  console.log('Processing DynamoDB record:', record);

  if (record.eventName !== 'MODIFY') {
    console.log('Skipping non-MODIFY event');
    return;
  }

  const newImage = record.dynamodb?.NewImage;
  if (!newImage) {
    console.log('No new image data found');
    return;
  }

  const imageId = newImage.id?.S;
  const status = newImage.status?.S;
  const reason = newImage.reason?.S;
  const email = newImage.email?.S || SES_EMAIL_TO;

  if (!imageId || !status) {
    console.log('Missing required fields in record');
    return;
  }

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

export const handler = async (event: DynamoDBStreamEvent, context: Context) => {
  console.log('Processing event:', JSON.stringify(event));

  try {
    await Promise.all(event.Records.map(sendEmail));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully sent all emails' })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    throw error;
  }
}; 