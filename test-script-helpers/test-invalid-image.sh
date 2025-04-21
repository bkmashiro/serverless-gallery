#!/bin/bash

if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

if [ -z "$BUCKET_NAME" ] || [ -z "$TABLE_NAME" ] || [ -z "$DLQ_URL" ]; then
    echo "Error: Required environment variables not set"
    exit 1
fi

# 1. Create an invalid text file
echo "This is an invalid image file" > invalid-image.txt

# 2. Upload invalid file to S3
echo "Uploading invalid file to S3 bucket: $BUCKET_NAME"
aws s3 cp invalid-image.txt s3://$BUCKET_NAME/

# 3. Wait for message to be moved to DLQ
echo "Waiting for message to be processed and moved to DLQ..."
sleep 30

# 4. Check messages in DLQ
echo "Checking messages in DLQ:"
aws sqs receive-message \
    --queue-url "$DLQ_URL" \
    --max-number-of-messages 10 \
    --output json

# 5. Invoke remove-image Lambda function
echo "Invoking remove-image Lambda function..."
aws lambda invoke \
    --function-name gallery-remove-image \
    --cli-binary-format raw-in-base64-out \
    --payload '{"Records":[{"s3":{"bucket":{"name":"'"$BUCKET_NAME"'"},"object":{"key":"invalid-image.txt"}}}]}' \
    response.json

echo "Lambda response:"
cat response.json
rm response.json
echo ""

# 6. Check if file was removed
echo "Checking if file was removed from S3:"
echo "=== begin ls s3://$BUCKET_NAME/ ==="
aws s3 ls s3://$BUCKET_NAME/invalid-image.txt
echo "=== end ls s3://$BUCKET_NAME/ ==="

# 7. Cleanup local files
rm invalid-image.txt 