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

# 1. 清理：确保没有遗留的测试文件
echo "Cleaning up any existing test files..."
aws s3 rm s3://$BUCKET_NAME/test-image.png

# 2. 上传图片到 S3
echo "Uploading image to S3 bucket: $BUCKET_NAME"
aws s3 cp ../images/test-image.png s3://$BUCKET_NAME/

# 3. 检查 S3 中的文件
echo "Listing files in S3 bucket:"
aws s3 ls s3://$BUCKET_NAME/

# 4. 等待 Lambda 处理
echo "Waiting for Lambda to process the image..."
sleep 10

# 5. 检查 DynamoDB 中的记录
echo "Checking image metadata in DynamoDB table: $TABLE_NAME"
aws dynamodb get-item \
    --table-name "$TABLE_NAME" \
    --key '{"id": {"S": "test-image.png"}}' \
    --output json

# 6. 清理：删除测试文件
echo "Cleaning up: removing test file from S3"
aws s3 rm s3://$BUCKET_NAME/test-image.png