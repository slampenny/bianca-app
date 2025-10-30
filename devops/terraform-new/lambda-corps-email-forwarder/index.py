"""
AWS Lambda function to forward emails from biancatechnologies.com to Gmail addresses.

This function:
1. Receives SES email events from S3
2. Parses the email content (headers, body, attachments)
3. Looks up recipient mapping from environment variables
4. Forwards the email to the mapped Gmail address using SES
5. Preserves original sender in Reply-To header
"""

import json
import os
import boto3
import email
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formataddr
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
# AWS_REGION is automatically set by Lambda runtime
s3_client = boto3.client('s3')
ses_client = boto3.client('ses')

# Get configuration from environment variables
EMAIL_MAPPINGS = json.loads(os.environ.get('EMAIL_MAPPINGS', '{}'))
FROM_DOMAIN = os.environ.get('FROM_DOMAIN', 'biancatechnologies.com')
S3_BUCKET = os.environ.get('S3_BUCKET', '')
# AWS_REGION is automatically set by Lambda runtime, use that if available
AWS_REGION = os.environ.get('AWS_REGION', os.environ.get('AWS_DEFAULT_REGION', 'us-east-2'))


def get_email_from_s3(bucket, key):
    """
    Retrieve email object from S3.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        
    Returns:
        Email message object
    """
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        email_content = response['Body'].read()
        return email.message_from_bytes(email_content)
    except Exception as e:
        logger.error(f"Error retrieving email from S3 ({bucket}/{key}): {str(e)}")
        raise


def find_recipient_mapping(recipient_email):
    """
    Find the Gmail address for a corporate email address.
    
    Args:
        recipient_email: Corporate email address (e.g., jlapp@biancatechnologies.com)
        
    Returns:
        Gmail address or None if not found
    """
    normalized_recipient = recipient_email.lower().strip()
    return EMAIL_MAPPINGS.get(normalized_recipient)


def create_forwarded_email(original_email, recipient_email, forward_to_email):
    """
    Create a new email message that forwards the original email.
    Preserves original sender in Reply-To header.
    
    Args:
        original_email: Original email.message.EmailMessage object
        recipient_email: Original recipient (corporate email)
        forward_to_email: Destination Gmail address
        
    Returns:
        Raw email message string ready for SES sendRawEmail
    """
    # Create a new MIME message
    msg = MIMEMultipart()
    
    # Get original headers
    original_from = original_email.get('From', 'Unknown')
    original_to = original_email.get('To', recipient_email)
    original_subject = original_email.get('Subject', '(No Subject)')
    original_date = original_email.get('Date', '')
    
    # Set headers for forwarded email
    msg['From'] = formataddr((None, f"noreply@{FROM_DOMAIN}"))
    msg['To'] = forward_to_email
    msg['Subject'] = f"Fwd: {original_subject}"
    
    # Preserve original sender in Reply-To header
    msg['Reply-To'] = original_from
    
    # Add original email metadata
    original_info = f"""
--- Original Email ---
From: {original_from}
To: {original_to}
Date: {original_date}
Subject: {original_subject}
"""
    
    # Get email body
    body = ""
    if original_email.is_multipart():
        # Handle multipart messages
        for part in original_email.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            
            # Skip attachments for now (they're in the body)
            if "attachment" in content_disposition:
                continue
            
            try:
                if content_type == "text/plain":
                    body += part.get_payload(decode=True).decode('utf-8', errors='ignore')
                elif content_type == "text/html":
                    # For HTML emails, we'll include them as plain text for simplicity
                    html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    body += f"\n[HTML content]\n"
            except Exception as e:
                logger.warning(f"Error parsing email part: {str(e)}")
    else:
        # Plain text email
        try:
            body = original_email.get_payload(decode=True).decode('utf-8', errors='ignore')
        except Exception as e:
            logger.warning(f"Error getting email body: {str(e)}")
            body = "[Unable to decode email body]"
    
    # Create the email body with original email info
    email_body = original_info + "\n" + body
    
    # Attach the body
    msg.attach(MIMEText(email_body, 'plain'))
    
    # Handle attachments from multipart emails
    if original_email.is_multipart():
        for part in original_email.walk():
            content_disposition = str(part.get("Content-Disposition"))
            
            if "attachment" in content_disposition:
                try:
                    # Get attachment details
                    filename = part.get_filename()
                    if filename:
                        # Create attachment
                        attachment = MIMEBase(
                            *part.get_content_type().split('/', 1)
                        )
                        attachment.set_payload(part.get_payload(decode=True))
                        encoders.encode_base64(attachment)
                        attachment.add_header(
                            'Content-Disposition',
                            f'attachment; filename= {filename}'
                        )
                        msg.attach(attachment)
                except Exception as e:
                    logger.warning(f"Error attaching file {filename}: {str(e)}")
    
    return msg.as_string()


def handler(event, context):
    """
    Main Lambda handler function.
    
    This function handles two types of events:
    
    1. S3 Event (preferred - more reliable):
    {
        "Records": [
            {
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": "bucket-name"},
                    "object": {"key": "emails/message-id"}
                }
            }
        ]
    }
    
    2. SES Event (fallback):
    {
        "Records": [
            {
                "ses": {
                    "mail": {
                        "messageId": "...",
                        "source": "sender@example.com",
                        "destination": ["recipient@biancatechnologies.com"]
                    }
                }
            }
        ]
    }
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    try:
        emails_to_process = []
        
        # Process each record in the event
        for record in event.get('Records', []):
            # Check if this is an S3 event (preferred)
            if 's3' in record:
                s3_data = record.get('s3', {})
                bucket_name = s3_data.get('bucket', {}).get('name', S3_BUCKET)
                object_key = s3_data.get('object', {}).get('key', '')
                
                if not object_key or not object_key.startswith('emails/'):
                    logger.info(f"Skipping non-email S3 object: {object_key}")
                    continue
                
                # Extract recipients from the object key or event
                # SES stores emails with message ID, we'll need to parse the email to get recipients
                emails_to_process.append({
                    'bucket': bucket_name,
                    'key': object_key,
                    'source': 'S3'
                })
            
            # Check if this is an SES event (fallback)
            elif 'ses' in record:
                ses_record = record.get('ses', {})
                mail_data = ses_record.get('mail', {})
                receipt_data = ses_record.get('receipt', {})
                
                # Get email details
                message_id = mail_data.get('messageId')
                recipients = mail_data.get('destination', [])
                source = mail_data.get('source', 'unknown@example.com')
                
                # Skip if spam or virus detected
                spam_verdict = receipt_data.get('spamVerdict', {}).get('status', '')
                virus_verdict = receipt_data.get('virusVerdict', {}).get('status', '')
                
                if spam_verdict == 'FAIL' or virus_verdict == 'FAIL':
                    logger.warning(
                        f"Skipping email {message_id} - Spam: {spam_verdict}, Virus: {virus_verdict}"
                    )
                    continue
                
                # Construct S3 key from message ID
                # SES stores emails with the message ID as part of the key
                bucket_name = S3_BUCKET
                object_key = f'emails/{message_id}'
                
                emails_to_process.append({
                    'bucket': bucket_name,
                    'key': object_key,
                    'source': 'SES',
                    'recipients': recipients,
                    'message_id': message_id
                })
        
        # Process each email
        for email_info in emails_to_process:
            bucket_name = email_info['bucket']
            object_key = email_info['key']
            
            try:
                # Get original email from S3
                original_email = get_email_from_s3(bucket_name, object_key)
                
                # Extract recipients from email headers if not already provided
                recipients = email_info.get('recipients', [])
                if not recipients:
                    # Parse recipients from email To, Cc, Bcc headers
                    to_header = original_email.get('To', '')
                    cc_header = original_email.get('Cc', '')
                    recipients = []
                    
                    # Parse email addresses from headers
                    import re
                    email_pattern = r'[\w\.-]+@[\w\.-]+\.\w+'
                    if to_header:
                        recipients.extend(re.findall(email_pattern, to_header))
                    if cc_header:
                        recipients.extend(re.findall(email_pattern, cc_header))
                    
                    # Fallback to envelope recipient if headers don't have addresses
                    if not recipients:
                        # Try to extract from Delivered-To or other headers
                        delivered_to = original_email.get('Delivered-To', '')
                        if delivered_to:
                            recipients = [delivered_to.strip()]
                
                # Process each recipient
                for recipient in recipients:
                    recipient_lower = recipient.lower().strip()
                    
                    # Find the Gmail mapping
                    forward_to = find_recipient_mapping(recipient_lower)
                    
                    if not forward_to:
                        logger.warning(
                            f"No email mapping found for {recipient_lower}. Email will not be forwarded."
                        )
                        continue
                    
                    logger.info(f"Forwarding {recipient_lower} -> {forward_to}")
                    
                    try:
                        # Create forwarded email
                        forwarded_email = create_forwarded_email(
                            original_email,
                            recipient_lower,
                            forward_to
                        )
                        
                        # Send using SES
                        ses_client.send_raw_email(
                            Source=f"noreply@{FROM_DOMAIN}",
                            Destinations=[forward_to],
                            RawMessage={'Data': forwarded_email.encode('utf-8')}
                        )
                        
                        logger.info(
                            f"Successfully forwarded email to {forward_to} "
                            f"(original recipient: {recipient_lower})"
                        )
                        
                    except Exception as e:
                        logger.error(
                            f"Error forwarding email for {recipient_lower} to {forward_to}: {str(e)}",
                            exc_info=True
                        )
                        # Continue processing other recipients even if one fails
                        continue
                        
            except Exception as e:
                logger.error(
                    f"Error processing email from S3 ({bucket_name}/{object_key}): {str(e)}",
                    exc_info=True
                )
                # Continue with next email
                continue
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Email forwarding processed successfully'
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing email event: {str(e)}", exc_info=True)
        raise

