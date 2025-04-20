#!/bin/bash

# 加载环境变量
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

# 检查必要的环境变量
if [ -z "$TOPIC_ARN" ] || [ -z "$TABLE_NAME" ]; then
    echo "Error: Required environment variables not set"
    exit 1
fi

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 创建临时消息文件
create_message_files() {
    local metadata_type=$1
    local value=$2
    
    # 创建消息体
    cat > message.json << EOF
{
    "id": "test-image.png",
    "value": "$value"
}
EOF

    # 创建消息属性
    cat > attributes.json << EOF
{
    "metadata_type": {
        "DataType": "String",
        "StringValue": "$metadata_type"
    }
}
EOF
}

# 清理临时文件
cleanup() {
    rm -f message.json attributes.json
    print_success "Cleanup completed"
}

# 测试添加元数据
test_add_metadata() {
    local metadata_type=$1
    local value=$2
    
    echo "Testing adding $metadata_type metadata..."
    
    # 创建消息文件
    create_message_files "$metadata_type" "$value"
    
    # 发布消息到 SNS
    if aws sns publish \
        --topic-arn "$TOPIC_ARN" \
        --message-attributes file://attributes.json \
        --message file://message.json; then
        print_success "Message published successfully"
    else
        print_error "Failed to publish message"
        return 1
    fi
    
    # 等待 Lambda 处理
    echo "Waiting for Lambda to process the metadata..."
    sleep 5
    
    # 检查 DynamoDB 中的记录
    echo "Checking DynamoDB record..."
    if aws dynamodb get-item \
        --table-name "$TABLE_NAME" \
        --key "{\"id\": {\"S\": \"test-image.png\"}}" \
        --output json | grep -q "$value"; then
        print_success "Metadata updated successfully"
    else
        print_error "Failed to update metadata"
        return 1
    fi
}

# 主测试流程
main() {
    echo "Starting metadata tests..."
    
    # 确保在脚本退出时清理
    trap cleanup EXIT
    
    # 测试添加标题
    if ! test_add_metadata "Caption" "Olympic 100m final - 2024"; then
        print_error "Caption test failed"
        exit 1
    fi
    
    # 测试添加日期
    if ! test_add_metadata "Date" "2024-07-26"; then
        print_error "Date test failed"
        exit 1
    fi
    
    # 测试添加摄影师姓名
    if ! test_add_metadata "Name" "John Smith"; then
        print_error "Name test failed"
        exit 1
    fi
    
    print_success "All metadata tests completed successfully!"
}

# 运行主测试
main 