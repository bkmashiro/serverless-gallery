#!/bin/bash

if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

if [ -z "$BUCKET_NAME" ] || [ -z "$TABLE_NAME" ]; then
    echo "Error: Required environment variables not set"
    exit 1
fi

# 1. Upload test image
echo "Uploading test image to S3 bucket: $BUCKET_NAME"
aws s3 cp ../images/test-image.png s3://$BUCKET_NAME/

# 2. Wait for Lambda processing
echo "Waiting for Lambda to process the image..."
sleep 10

# 3. Update DynamoDB record to trigger Stream
echo "Updating DynamoDB record to trigger Stream"
aws dynamodb update-item \
    --table-name "$TABLE_NAME" \
    --key '{"id": {"S": "test-image.png"}}' \
    --update-expression "SET #status = :status, #email = :email" \
    --expression-attribute-names '{"#status": "status", "#email": "email"}' \
    --expression-attribute-values '{
        ":status": {"S": "pending"},
        ":email": {"S": "20108862@mail.wit.ie"}
    }'

# 4. Wait for Lambda processing
echo "Waiting for Lambda to process notification..."
sleep 10

# 5. Cleanup: remove test file
echo "Cleaning up: removing test file from S3"
aws s3 rm s3://$BUCKET_NAME/test-image.png