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

# 1. 创建一个无效的文本文件
echo "This is an invalid image file" > invalid-image.txt

# 2. 上传无效文件到 S3
echo "Uploading invalid file to S3 bucket: $BUCKET_NAME"
aws s3 cp invalid-image.txt s3://$BUCKET_NAME/

# 3. 等待一段时间，让消息进入死信队列
echo "Waiting for message to be processed and moved to DLQ..."
sleep 30

# 4. 检查死信队列中的消息
echo "Checking messages in DLQ:"
aws sqs receive-message \
    --queue-url "$DLQ_URL" \
    --max-number-of-messages 10 \
    --output json

# 5. 调用删除 Lambda 函数
echo "Invoking remove-image Lambda function..."
aws lambda invoke \
    --function-name gallery-remove-image \
    --cli-binary-format raw-in-base64-out \
    --payload '{"Records":[{"s3":{"bucket":{"name":"'"$BUCKET_NAME"'"},"object":{"key":"invalid-image.txt"}}}]}' \
    response.json

echo "Lambda response:"
cat response.json
rm response.json

# 6. 检查文件是否已被删除
echo "Checking if file was removed from S3:"
aws s3 ls s3://$BUCKET_NAME/invalid-image.txt

# 7. 清理本地文件
rm invalid-image.txt 