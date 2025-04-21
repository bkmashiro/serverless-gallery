#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

# Check required environment variables
if [ -z "$TOPIC_ARN" ] || [ -z "$TABLE_NAME" ] || [ -z "$BUCKET_NAME" ]; then
    echo "Error: Required environment variables not set"
    exit 1
fi

# Color definitions
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Create temporary message files
create_message_files() {
    local metadata_type=$1
    local value=$2
    
    # Create message body
    cat > message.json << EOF
{
    "id": "test-image.png",
    "value": "$value"
}
EOF

    # Create message attributes
    cat > attributes.json << EOF
{
    "metadata_type": {
        "DataType": "String",
        "StringValue": "$metadata_type"
    },
    "eventType": {
        "DataType": "String",
        "StringValue": "metadata-update"
    }
}
EOF
}

# Cleanup temporary files and S3 objects
cleanup() {
    rm -f message.json attributes.json
    echo "Cleaning up test image from S3..."
    aws s3 rm s3://$BUCKET_NAME/test-image.png
    print_success "Cleanup completed"
}

# Upload test image
upload_test_image() {
    echo "Uploading test image to S3..."
    if aws s3 cp ../images/test-image.png s3://$BUCKET_NAME/; then
        print_success "Image uploaded successfully"
        # Wait for Lambda processing
        echo "Waiting for Lambda to process the image..."
        sleep 10
    else
        print_error "Failed to upload image"
        return 1
    fi
}

# Get and display DynamoDB record
get_dynamodb_record() {
    echo "Current DynamoDB record:"
    aws dynamodb get-item \
        --table-name "$TABLE_NAME" \
        --key "{\"id\": {\"S\": \"test-image.png\"}}" \
        --output json
}

# Test adding metadata
test_add_metadata() {
    local metadata_type=$1
    local value=$2
    
    echo "Testing adding $metadata_type metadata..."
    
    # Create message files
    create_message_files "$metadata_type" "$value"
    
    # Publish message to SNS
    if aws sns publish \
        --topic-arn "$TOPIC_ARN" \
        --message-attributes file://attributes.json \
        --message file://message.json; then
        print_success "Message published successfully"
    else
        print_error "Failed to publish message"
        return 1
    fi
    
    # Wait for Lambda processing
    echo "Waiting for Lambda to process the metadata..."
    sleep 10
    
    # Check record in DynamoDB
    echo "Checking DynamoDB record..."
    get_dynamodb_record
    
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

# Main test process
main() {
    echo "Starting metadata tests..."
    
    # Ensure cleanup on script exit
    trap cleanup EXIT
    
    # Upload test image
    if ! upload_test_image; then
        print_error "Failed to upload test image"
        exit 1
    fi
    
    # Display initial record
    echo "Initial DynamoDB record:"
    get_dynamodb_record
    
    # Test adding caption
    if ! test_add_metadata "Caption" "Yuzhe Shi"; then
        print_error "Caption test failed"
        exit 1
    fi
    
    # Test adding date
    if ! test_add_metadata "Date" "2025-04-20"; then
        print_error "Date test failed"
        exit 1
    fi
    
    # Test adding photographer name
    if ! test_add_metadata "Name" "Shimizu Nagisa"; then
        print_error "Name test failed"
        exit 1
    fi
    
    # Display final record
    echo "Final DynamoDB record:"
    get_dynamodb_record
    
    print_success "All metadata tests completed successfully!"
}

# Run main test
main 