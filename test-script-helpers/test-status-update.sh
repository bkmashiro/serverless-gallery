#!/bin/bash

if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

if [ -z "$BUCKET_NAME" ] || [ -z "$TABLE_NAME" ] || [ -z "$TOPIC_ARN" ]; then
    echo "Error: Required environment variables not set"
    exit 1
fi

# 1. 上传测试图片
echo "Uploading test image to S3 bucket: $BUCKET_NAME"
aws s3 cp ../images/test-image.png s3://$BUCKET_NAME/

# 2. 等待 Lambda 处理
echo "Waiting for Lambda to process the image..."
sleep 10

# 3. 发布状态更新消息到 SNS
echo "Publishing status update to SNS topic"
aws sns publish \
    --topic-arn "$TOPIC_ARN" \
    --message '{
        "imageId": "test-image.png",
        "status": "approved",
        "eventType": "status_update"
    }' \
    --message-attributes '{
        "eventType": {
            "DataType": "String",
            "StringValue": "status_update"
        },
        "status": {
            "DataType": "String",
            "StringValue": "approved"
        }
    }'

# 4. 等待 Lambda 处理
echo "Waiting for Lambda to process status update..."
sleep 10

# 5. 检查更新后的状态
echo "Checking updated status in DynamoDB table: $TABLE_NAME"
aws dynamodb get-item \
    --table-name "$TABLE_NAME" \
    --key '{"id": {"S": "test-image.png"}}' \
    --output json

# 6. 清理：删除测试文件
echo "Cleaning up: removing test file from S3"
aws s3 rm s3://$BUCKET_NAME/test-image.png