#!/usr/bin/env python3
"""
Local test script for Lambda email forwarder function.
This simulates an S3 event to test the Lambda function logic locally.
"""

import json
import os
import sys

# Add Lambda function directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lambda-corps-email-forwarder'))

# Mock AWS services for local testing
class MockS3Client:
    """Mock S3 client for local testing"""
    
    def get_object(self, Bucket, Key):
        """Return a mock email object"""
        # Create a simple test email
        test_email = """From: test-sender@example.com
To: jlapp@biancatechnologies.com
Subject: Test Email
Date: Mon, 15 Jan 2025 12:00:00 -0000
Content-Type: text/plain

This is a test email to verify the forwarding logic works.
"""
        
        class MockResponse:
            def __init__(self, content):
                self.content = content
            
            @property
            def Body(self):
                class MockBody:
                    def read(self):
                        return self.content.encode('utf-8')
                return MockBody()
        
        return MockResponse(test_email)


class MockSESClient:
    """Mock SES client for local testing"""
    
    def send_raw_email(self, Source, Destinations, RawMessage):
        """Mock sending email - just prints what would be sent"""
        print(f"\n[MOCK SES] Would send email:")
        print(f"  From: {Source}")
        print(f"  To: {Destinations}")
        print(f"  Raw message length: {len(RawMessage['Data'])} bytes")
        return {'MessageId': 'mock-message-id'}


# Mock the boto3 clients
import boto3
original_client = boto3.client

def mock_client(service, **kwargs):
    if service == 's3':
        return MockS3Client()
    elif service == 'ses':
        return MockSESClient()
    else:
        return original_client(service, **kwargs)

# Override boto3.client for testing
boto3.client = mock_client

# Set up environment variables
os.environ['EMAIL_MAPPINGS'] = json.dumps({
    "jlapp@biancatechnologies.com": "negascout@gmail.com",
    "vthaker@biancatechnologies.com": "virenthaker@gmail.com"
})
os.environ['FROM_DOMAIN'] = 'biancatechnologies.com'
os.environ['AWS_REGION'] = 'us-east-2'
os.environ['S3_BUCKET'] = 'bianca-corp-email-storage-test'

# Import and test the handler
from index import handler

def test_s3_event():
    """Test with S3 event"""
    print("=" * 60)
    print("Testing with S3 Event")
    print("=" * 60)
    
    event = {
        "Records": [
            {
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": "bianca-corp-email-storage-test"},
                    "object": {"key": "emails/test-message-id-123"}
                }
            }
        ]
    }
    
    result = handler(event, None)
    print(f"\nResult: {json.dumps(result, indent=2)}")
    return result


def test_ses_event():
    """Test with SES event"""
    print("\n" + "=" * 60)
    print("Testing with SES Event")
    print("=" * 60)
    
    event = {
        "Records": [
            {
                "ses": {
                    "mail": {
                        "messageId": "test-message-id-456",
                        "source": "sender@example.com",
                        "destination": ["jlapp@biancatechnologies.com"]
                    },
                    "receipt": {
                        "recipients": ["jlapp@biancatechnologies.com"],
                        "spamVerdict": {"status": "PASS"},
                        "virusVerdict": {"status": "PASS"},
                        "action": [
                            {
                                "type": "S3",
                                "bucketName": "bianca-corp-email-storage-test",
                                "objectKey": "emails/test-message-id-456"
                            }
                        ]
                    }
                }
            }
        ]
    }
    
    result = handler(event, None)
    print(f"\nResult: {json.dumps(result, indent=2)}")
    return result


def test_unmapped_email():
    """Test with email that has no mapping"""
    print("\n" + "=" * 60)
    print("Testing with Unmapped Email")
    print("=" * 60)
    
    event = {
        "Records": [
            {
                "ses": {
                    "mail": {
                        "messageId": "test-message-id-789",
                        "source": "sender@example.com",
                        "destination": ["unknown@biancatechnologies.com"]
                    },
                    "receipt": {
                        "recipients": ["unknown@biancatechnologies.com"],
                        "spamVerdict": {"status": "PASS"},
                        "virusVerdict": {"status": "PASS"}
                    }
                }
            }
        ]
    }
    
    result = handler(event, None)
    print(f"\nResult: {json.dumps(result, indent=2)}")
    return result


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Lambda Email Forwarder - Local Testing")
    print("=" * 60)
    
    try:
        # Test 1: S3 Event
        result1 = test_s3_event()
        
        # Test 2: SES Event
        result2 = test_ses_event()
        
        # Test 3: Unmapped email
        result3 = test_unmapped_email()
        
        print("\n" + "=" * 60)
        print("All Tests Completed")
        print("=" * 60)
        print("\nNote: This is a local mock test. For real testing:")
        print("1. Deploy with Terraform")
        print("2. Send actual test emails")
        print("3. Check CloudWatch logs")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

