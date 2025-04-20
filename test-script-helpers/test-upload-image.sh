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
# remove the image from s3
aws s3 rm s3://$BUCKET_NAME/test-image.png

# 1. upload image to s3
echo "Uploading image to S3 bucket: $BUCKET_NAME"
aws s3 cp ../images/test-image.png s3://$BUCKET_NAME/

# 检查 S3 中的文件
echo "Listing files in S3 bucket:"
aws s3 ls s3://$BUCKET_NAME/

# 2. check if the image is in the table
echo "Checking image in DynamoDB table: $TABLE_NAME"
aws dynamodb get-item \
    --table-name "$TABLE_NAME" \
    --key '{"id": {"S": "test-image.png"}}' \
    --output json