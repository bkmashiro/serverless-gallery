# Serverless Photo Gallery

## Distributed Systems - Event-Driven Architecture

**Name:** Yuzhe Shi (20108862@mail.wit.ie)

**Demo:** [https://youtu.be/dMAT0ee9UVY](https://youtu.be/dMAT0ee9UVY)

This repository contains the implementation of a serverless photo gallery application using an event-driven architecture on AWS. The application is built using AWS CDK for infrastructure provisioning and TypeScript for implementation.

![](./images/arch.png)

## Feature Status

**Feature:**

- Photographer:
  - Log new Images - Completed and Tested
  - Metadata updating - Completed and Tested
  - Invalid image removal - Completed and Tested
  - Status Update Mailer - Completed and Tested
- Moderator:
  - Status updating - Completed and Tested

## Notes

- sns.SubscriptionFilter.stringFilter is used to filter out irrelevant messages. For example, image metadata messages should not appear in the SQS Queue.
- All Lambda functions are fully tested with Jest
- To simplify end-to-end testing, 6 test scripts are provided in `test-script-helpers`

### Project Structure

- `bin/` - CDK application entry point
- `lib/` - CDK stack definitions
- `lambdas/` - AWS Lambda function implementations
  - `add-metadata/` - Handles image metadata updates
  - `confirmation-mailer/` - Sends email notifications
  - `log-image/` - Processes new image uploads
  - `remove-image/` - Handles invalid image removal
  - `update-status/` - Updates image status
- `shared/` - Shared types and utilities
- `test/` - Integration tests
- `test-script-helpers/` - Helper scripts for testing
- `images/` - Architecture diagrams and documentation images

### Technical Stack

- AWS CDK for infrastructure as code
- AWS Lambda for serverless functions
- Amazon S3 for image storage
- Amazon DynamoDB for metadata storage
- Amazon SQS for message queuing
- Amazon SNS for notifications
- Amazon SES for email delivery
- TypeScript for implementation
- Jest for testing

### Getting Started

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env` file (`test-script-helpers/.env`,refer to `.env.example`) and `env.ts

3. Deploy the stack:

```bash
cdk deploy
```

4. Run tests:

```bash
npm test
```

5. Run the test script:

```bash
cd test-script-helpers
bash test-confirmation-mailer.sh
bash test-invalid-image.sh
bash test-metadata.sh
bash test-upload-image.sh
bash test-status-update.sh
```
