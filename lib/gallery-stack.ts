import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

export class GalleryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for storing images
    const imageBucket = new s3.Bucket(this, 'ImageBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB table for storing image metadata
    const imageTable = new dynamodb.Table(this, 'ImageTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // SNS Topic for image events
    const imageTopic = new sns.Topic(this, 'ImageTopic');

    // SQS Queue and DLQ
    const dlq = new sqs.Queue(this, 'ImageDLQ', {
      queueName: 'image-dlq',
    });

    const imageQueue = new sqs.Queue(this, 'ImageQueue', {
      queueName: 'image-queue',
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Lambda Functions
    const logImageFn = new nodeLambda.NodejsFunction(this, 'LogImageFunction', {
      entry: path.join(__dirname, '../lambdas/log-image/index.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: imageTable.tableName,
      },
    });

    const removeImageFn = new nodeLambda.NodejsFunction(this, 'RemoveImageFunction', {
      entry: path.join(__dirname, '../lambdas/remove-image/index.ts'),
      handler: 'handler',
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
      },
    });

    const addMetadataFn = new nodeLambda.NodejsFunction(this, 'AddMetadataFunction', {
      entry: path.join(__dirname, '../lambdas/add-metadata/index.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: imageTable.tableName,
      },
    });

    const updateStatusFn = new nodeLambda.NodejsFunction(this, 'UpdateStatusFunction', {
      entry: path.join(__dirname, '../lambdas/update-status/index.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: imageTable.tableName,
      },
    });

    const confirmationMailerFn = new nodeLambda.NodejsFunction(this, 'ConfirmationMailerFunction', {
      entry: path.join(__dirname, '../lambdas/confirmation-mailer/index.ts'),
      handler: 'handler',
      environment: {
        FROM_EMAIL: 'your-verified-email@example.com', // Replace with your SES verified email
      },
    });

    // Grant permissions
    imageBucket.grantReadWrite(logImageFn);
    imageBucket.grantRead(removeImageFn);
    imageTable.grantReadWriteData(logImageFn);
    imageTable.grantReadWriteData(addMetadataFn);
    imageTable.grantReadWriteData(updateStatusFn);
    
    // Add SNS Topic subscriptions with filters
    imageTopic.addSubscription(
      new subscriptions.SqsSubscription(imageQueue, {
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['image-upload'],
          }),
        },
      })
    );

    imageTopic.addSubscription(
      new subscriptions.LambdaSubscription(addMetadataFn, {
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['metadata-update'],
          }),
        },
      })
    );

    imageTopic.addSubscription(
      new subscriptions.LambdaSubscription(updateStatusFn, {
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['status_update'],
          }),
          status: sns.SubscriptionFilter.stringFilter({
            allowlist: ['approved', 'rejected'],
          }),
        },
      })
    );

    imageTopic.addSubscription(
      new subscriptions.LambdaSubscription(confirmationMailerFn, {
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['notification'],
          }),
          notificationType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['email'],
          }),
        },
      })
    );

    // Grant SES permissions to confirmation mailer
    confirmationMailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // Add DynamoDB Stream trigger for confirmation mailer
    confirmationMailerFn.addEventSource(
      new eventsources.DynamoEventSource(imageTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 1,
        retryAttempts: 3,
      })
    );
  }
} 