const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-2' });
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-2' });

exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    try {
        // Parse RECIPIENT_MAP from environment variable
        const recipientMap = JSON.parse(process.env.RECIPIENT_MAP || '{}');
        const fromDomain = process.env.FROM_DOMAIN || 'biancawellness.com';
        
        // Handle S3 events (SES stores emails in S3 first)
        if (event.Records && event.Records[0] && event.Records[0].s3) {
            // CRITICAL: Check if this email was already forwarded by us (prevent loops)
            // We'll check the email headers for X-Forwarded-By header
            const bucket = event.Records[0].s3.bucket.name;
            const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
            
            console.log(`Processing email from S3: ${bucket}/${key}`);
            
            // Get email from S3
            const getObjectResponse = await s3Client.send(new GetObjectCommand({
                Bucket: bucket,
                Key: key
            }));
            
            // Read email content
            const emailContent = await streamToBuffer(getObjectResponse.Body);
            const emailText = emailContent.toString('utf-8');
            
            // Parse email headers manually
            const headerEnd = emailText.indexOf('\r\n\r\n') >= 0 ? emailText.indexOf('\r\n\r\n') : emailText.indexOf('\n\n');
            const headers = emailText.substring(0, headerEnd || emailText.length);
            const body = emailText.substring(headerEnd ? headerEnd + 4 : emailText.length);
            
            // CRITICAL: Check if this email was already forwarded by us (prevent loops)
            const forwardedByMatch = headers.match(/^X-Forwarded-By:\s*(.+)$/mi);
            if (forwardedByMatch && forwardedByMatch[1].includes('lambda-email-forwarder')) {
                console.log('Email already forwarded by Lambda (X-Forwarded-By header detected) - skipping to prevent loop');
                return { statusCode: 200, body: 'Email already forwarded, skipping' };
            }
            
            // Extract recipient from headers
            const toMatch = headers.match(/^To:\s*(.+)$/mi) || headers.match(/^Delivered-To:\s*(.+)$/mi);
            let toAddress = toMatch ? toMatch[1].trim() : null;
            
            // Extract email from "Name <email@domain.com>" format
            if (toAddress && toAddress.includes('<')) {
                toAddress = toAddress.match(/<([^>]+)>/)?.[1] || toAddress;
            }
            
            if (!toAddress) {
                console.error('Could not determine recipient from email headers');
                console.log('Headers:', headers.substring(0, 500));
                return { statusCode: 200 };
            }
            
            const recipientLower = toAddress.toLowerCase();
            const forwardTo = recipientMap[recipientLower];
            
            if (!forwardTo) {
                console.warn(`No mapping found for ${recipientLower}`);
                console.log('Available mappings:', Object.keys(recipientMap));
                return { statusCode: 200 };
            }
            
            // CRITICAL: If forwardTo is the same as recipientLower, this would create a loop
            // Skip forwarding if they match (shouldn't happen, but safety check)
            if (forwardTo.toLowerCase() === recipientLower) {
                console.warn(`Forward destination matches recipient - skipping to prevent loop: ${recipientLower}`);
                return { statusCode: 200, body: 'Forward destination matches recipient, skipping' };
            }
            
            console.log(`Forwarding ${recipientLower} -> ${forwardTo}`);
            
            // Extract other headers
            const subjectMatch = headers.match(/^Subject:\s*(.+)$/mi);
            const subject = subjectMatch ? subjectMatch[1].trim() : 'No Subject';
            
            // Forward email: change To, update Subject, change From to use the corporate address
            // Extract original sender for Reply-To
            const fromMatch = headers.match(/^From:\s*(.+)$/mi);
            let originalSender = fromMatch ? fromMatch[1].trim() : null;
            
            // Extract clean email address from original sender
            let originalSenderEmail = originalSender;
            if (originalSender) {
                const emailMatch = originalSender.match(/<([^>]+)>/);
                if (emailMatch) {
                    originalSenderEmail = emailMatch[1];
                } else {
                    // If no angle brackets, try to extract email from plain format
                    const plainMatch = originalSender.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                    if (plainMatch) {
                        originalSenderEmail = plainMatch[1];
                    }
                }
            }
            
            // Use the corporate email address as From
            const fromAddress = recipientLower; // e.g., jlapp@biancatechnologies.com
            
            // Format From header with display name to help Gmail recognize it
            // Use a more readable display name format that Gmail recognizes
            const fromDisplayName = fromAddress.split('@')[0]; // e.g., "jlapp"
            // Try to extract original sender's name if available for better display
            let displayName = fromDisplayName;
            if (originalSender) {
                const nameMatch = originalSender.match(/^"([^"]+)"|^([^<]+?)\s*</);
                if (nameMatch) {
                    displayName = nameMatch[1] || nameMatch[2] || fromDisplayName;
                }
            }
            // Format: "Display Name <email@domain.com>" - Gmail recognizes this format
            const fromHeader = `${displayName} <${fromAddress}>`;
            
            // Properly rebuild email headers
            // Split headers and body - find first blank line (header/body separator)
            let emailHeaderEnd = emailText.indexOf('\r\n\r\n');
            let headerBodySeparatorLength = 4; // \r\n\r\n
            if (emailHeaderEnd < 0) {
                emailHeaderEnd = emailText.indexOf('\n\n');
                headerBodySeparatorLength = 2; // \n\n
            }
            if (emailHeaderEnd < 0) {
                emailHeaderEnd = emailText.length; // No separator found
                headerBodySeparatorLength = 0;
            }
            
            const originalHeaders = emailText.substring(0, emailHeaderEnd);
            const emailBody = emailText.substring(emailHeaderEnd + headerBodySeparatorLength);
            
            // Build new headers section - preserve important headers, replace critical ones
            const headerLines = originalHeaders.split(/\r?\n/);
            const newHeaders = [];
            
            // Add required headers first (RFC 5322 order: Return-Path, Received, From, Reply-To, To, Subject)
            newHeaders.push(`Return-Path: ${fromAddress}`);
            
            // Preserve Received headers (they come after Return-Path)
            for (const line of headerLines) {
                if (/^Received:/i.test(line)) {
                    newHeaders.push(line);
                }
            }
            
            // Add From header
            newHeaders.push(`From: ${fromHeader}`);
            
            // To header: forwardTo (where email is delivered)
            newHeaders.push(`To: ${forwardTo}`);
            
            // Reply-To MUST be the original sender
            if (originalSenderEmail) {
                newHeaders.push(`Reply-To: ${originalSenderEmail}`);
            }
            
            newHeaders.push(`Subject: ${subject}`);
            
            // Preserve other important headers (Message-ID, Date, Content-Type, etc.)
            // IMPORTANT: Do NOT preserve old "To", "From", "Reply-To", "Return-Path" headers
            // Only preserve first occurrence of each header
            const preserveHeaders = ['Message-ID', 'Date', 'MIME-Version', 'Content-Type', 'Content-Transfer-Encoding'];
            const skipHeaders = new Set(['to', 'from', 'reply-to', 'return-path', 'subject']); // Don't preserve these - we set them above
            const addedHeaders = new Set();
            for (const line of headerLines) {
                const headerName = line.split(':')[0].toLowerCase();
                // Skip headers we've already set
                if (skipHeaders.has(headerName)) {
                    continue;
                }
                if (preserveHeaders.some(h => line.match(new RegExp(`^${h}:`, 'i')))) {
                    if (!addedHeaders.has(headerName)) {
                        newHeaders.push(line);
                        addedHeaders.add(headerName);
                    }
                }
            }
            
            // Combine headers and body - preserve original line endings
            // Determine line ending from original email (check for \r\n first)
            const lineEnding = emailText.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
            // Make sure body separator matches line ending
            const bodySeparator = lineEnding + lineEnding;
            forwardedEmail = newHeaders.join(lineEnding) + bodySeparator + emailBody;
            
            console.log(`✅ Set From: ${fromHeader}, To: ${forwardTo}, Reply-To: ${originalSenderEmail || 'none'}`);
            
            // Log email headers before sending (first 500 chars to avoid huge logs)
            console.log(`📧 Email headers before sending (first 500 chars):`);
            const headerPreview = forwardedEmail.substring(0, forwardedEmail.indexOf('\r\n\r\n') >= 0 ? forwardedEmail.indexOf('\r\n\r\n') : forwardedEmail.indexOf('\n\n'));
            console.log(headerPreview.substring(0, 500));
            
            // Send via SES
            // Deliver only to forwardTo (negascout@gmail.com) to avoid duplicate emails
            // Gmail's "Reply from same address" won't work automatically because envelope
            // recipient is forwardTo, but user can manually select From address when replying
            try {
                const sendResponse = await sesClient.send(new SendRawEmailCommand({
                    Source: fromAddress,
                    Destinations: [forwardTo], // Only deliver to forwardTo (one email, no duplicates)
                    RawMessage: {
                        Data: Buffer.from(forwardedEmail, 'utf-8')
                    }
                }));
                console.log(`✅ Successfully forwarded email from ${recipientLower} to ${forwardTo}`);
                console.log(`   SES MessageId: ${sendResponse.MessageId || 'N/A'}`);
            } catch (sendError) {
                console.error(`❌ Failed to send forwarded email:`, sendError.message);
                console.error(`   From: ${fromAddress}, To: ${forwardTo}`);
                console.error(`   Error details:`, JSON.stringify(sendError, null, 2));
                throw sendError;
            }
        }
        // Handle direct SES events (fallback - extract from S3 using messageId)
        else if (event.Records && event.Records[0] && event.Records[0].ses) {
            const message = event.Records[0].ses.mail;
            const originalTo = message.destination[0]?.toLowerCase();
            const forwardTo = recipientMap[originalTo];
            
            if (!forwardTo) {
                console.warn(`No mapping found for ${originalTo}`);
                return { statusCode: 200 };
            }
            
            console.log(`Forwarding ${originalTo} -> ${forwardTo} (direct SES event)`);
            
            // For direct SES events, try to find email in S3 using messageId
            // SES stores emails with messageId in the key
            // NOTE: There may be a timing issue where Lambda runs before S3 write completes
            // Retry with exponential backoff
            const messageId = message.messageId;
            const bucket = process.env.S3_BUCKET || 'bianca-corp-email-storage-730335291008';
            const localpart = originalTo.split('@')[0];
            
            // Try common key patterns
            const keyPatterns = [
                `corp/${localpart}/${messageId}`,
                `corp/${localpart}/${messageId}.eml`,
                messageId,
                `${messageId}.eml`
            ];
            
            let emailFound = false;
            let lastError = null;
            
            // Retry up to 3 times with exponential backoff (S3 write might not be complete yet)
            for (let retry = 0; retry < 3 && !emailFound; retry++) {
                if (retry > 0) {
                    const delay = Math.pow(2, retry) * 500; // 1s, 2s
                    console.log(`Retry ${retry} after ${delay}ms delay...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                for (const keyPattern of keyPatterns) {
                    try {
                        console.log(`Trying S3 key pattern: ${keyPattern} (retry ${retry})`);
                        const getObjectResponse = await s3Client.send(new GetObjectCommand({
                            Bucket: bucket,
                            Key: keyPattern
                        }));
                        
                        const emailContent = await streamToBuffer(getObjectResponse.Body);
                        const emailText = emailContent.toString('utf-8');
                        
                        // Parse recipient from email to verify we have the right one
                        const headerEnd = emailText.indexOf('\r\n\r\n') >= 0 ? emailText.indexOf('\r\n\r\n') : emailText.indexOf('\n\n');
                        const headers = emailText.substring(0, headerEnd || emailText.length);
                        
                        // CRITICAL: Check for X-Forwarded-By header to prevent loops
                        const forwardedByMatch2 = headers.match(/^X-Forwarded-By:\s*(.+)$/mi);
                        if (forwardedByMatch2 && forwardedByMatch2[1].includes('lambda-email-forwarder')) {
                            console.log(`Email already forwarded (X-Forwarded-By detected) - skipping pattern ${keyPattern}`);
                            continue; // Try next pattern or retry
                        }
                        
                        const toMatch = headers.match(/^To:\s*(.+)$/mi);
                        if (toMatch && !toMatch[1].toLowerCase().includes(originalTo)) {
                            console.log(`S3 email found but recipient mismatch: ${toMatch[1]} vs ${originalTo}`);
                            continue;
                        }
                        
                        // Extract subject and original sender
                        const subjectMatch = headers.match(/^Subject:\s*(.+)$/mi);
                        const subject = subjectMatch ? subjectMatch[1].trim() : 'No Subject';
                        const fromMatch = headers.match(/^From:\s*(.+)$/mi);
                        const originalSender = fromMatch ? fromMatch[1].trim() : null;
                        
                        // Extract clean email address from original sender
                        let originalSenderEmail = originalSender;
                        if (originalSender) {
                            const emailMatch = originalSender.match(/<([^>]+)>/);
                            if (emailMatch) {
                                originalSenderEmail = emailMatch[1];
                            } else {
                                const plainMatch = originalSender.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                                if (plainMatch) {
                                    originalSenderEmail = plainMatch[1];
                                }
                            }
                        }
                        
                        // Use the corporate email address as From
                        const fromAddress = originalTo;
                        const fromDisplayName = fromAddress.split('@')[0];
                        // Try to extract original sender's name if available
                        let displayName2 = fromDisplayName;
                        if (originalSender) {
                            const nameMatch2 = originalSender.match(/^"([^"]+)"|^([^<]+?)\s*</);
                            if (nameMatch2) {
                                displayName2 = nameMatch2[1] || nameMatch2[2] || fromDisplayName;
                            }
                        }
                        const fromHeader = `${displayName2} <${fromAddress}>`;
                        
                        // Properly rebuild email headers (same logic as first path)
                        let emailHeaderEnd2 = emailText.indexOf('\r\n\r\n');
                        let headerBodySeparatorLength2 = 4; // \r\n\r\n
                        if (emailHeaderEnd2 < 0) {
                            emailHeaderEnd2 = emailText.indexOf('\n\n');
                            headerBodySeparatorLength2 = 2; // \n\n
                        }
                        if (emailHeaderEnd2 < 0) {
                            emailHeaderEnd2 = emailText.length; // No separator found
                            headerBodySeparatorLength2 = 0;
                        }
                        
                        const originalHeaders2 = emailText.substring(0, emailHeaderEnd2);
                        const emailBody2 = emailText.substring(emailHeaderEnd2 + headerBodySeparatorLength2);
                        
                        const headerLines2 = originalHeaders2.split(/\r?\n/);
                        const newHeaders2 = [];
                        
                        newHeaders2.push(`Return-Path: ${fromAddress}`);
                        
                        for (const line of headerLines2) {
                            if (/^Received:/i.test(line)) {
                                newHeaders2.push(line);
                            }
                        }
                        
                        newHeaders2.push(`From: ${fromHeader}`);
                        
                        // To header: forwardTo (where email is delivered)
                        newHeaders2.push(`To: ${forwardTo}`);
                        
                        // Reply-To MUST be original sender
                        if (originalSenderEmail) {
                            newHeaders2.push(`Reply-To: ${originalSenderEmail}`);
                        }
                        
                        newHeaders2.push(`Subject: ${subject}`);
                        
                        const preserveHeaders2 = ['Message-ID', 'Date', 'MIME-Version', 'Content-Type', 'Content-Transfer-Encoding'];
                        const skipHeaders2 = new Set(['to', 'from', 'reply-to', 'return-path', 'subject']); // Don't preserve these
                        const addedHeaders2 = new Set();
                        for (const line of headerLines2) {
                            const headerName2 = line.split(':')[0].toLowerCase();
                            // Skip headers we've already set
                            if (skipHeaders2.has(headerName2)) {
                                continue;
                            }
                            if (preserveHeaders2.some(h => line.match(new RegExp(`^${h}:`, 'i')))) {
                                if (!addedHeaders2.has(headerName2)) {
                                    newHeaders2.push(line);
                                    addedHeaders2.add(headerName2);
                                }
                            }
                        }
                        
                        const lineEnding2 = emailText.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
                        const bodySeparator2 = lineEnding2 + lineEnding2;
                        let forwardedEmail = newHeaders2.join(lineEnding2) + bodySeparator2 + emailBody2;
                        
                        console.log(`✅ Set From: ${fromHeader}, To: ${forwardTo}, Reply-To: ${originalSenderEmail || 'none'}`);
                        
                        // Log email headers before sending (first 500 chars)
                        const headerPreview2 = forwardedEmail.substring(0, forwardedEmail.indexOf('\r\n\r\n') >= 0 ? forwardedEmail.indexOf('\r\n\r\n') : forwardedEmail.indexOf('\n\n'));
                        console.log(`📧 Email headers before sending (pattern ${keyPattern}, first 500 chars):`);
                        console.log(headerPreview2.substring(0, 500));
                        
                        try {
                            const sendResponse = await sesClient.send(new SendRawEmailCommand({
                                Source: fromAddress,
                                Destinations: [forwardTo], // Only deliver to forwardTo (one email, no duplicates)
                                RawMessage: {
                                    Data: Buffer.from(forwardedEmail, 'utf-8')
                                }
                            }));
                            emailFound = true;
                            console.log(`✅ Successfully forwarded email using key pattern: ${keyPattern}`);
                            console.log(`   SES MessageId: ${sendResponse.MessageId || 'N/A'}`);
                            break;
                        } catch (sendError) {
                            console.error(`❌ Failed to send forwarded email (pattern ${keyPattern}):`, sendError.message);
                            console.error(`   Error details:`, JSON.stringify(sendError, null, 2));
                            // Continue to next pattern or retry
                            lastError = sendError;
                            continue;
                        }
                    } catch (err) {
                        lastError = err;
                        console.log(`Key pattern ${keyPattern} failed: ${err.message || err.code || err}`);
                        // Try next pattern
                        continue;
                    }
                }
            }
            
            if (!emailFound) {
                console.error(`Could not find email in S3 for messageId: ${messageId} after retries`);
                console.error(`Tried patterns: ${keyPatterns.join(', ')}`);
                console.error(`Last error: ${lastError ? (lastError.message || lastError.code || JSON.stringify(lastError)) : 'none'}`);
                console.error(`Bucket: ${bucket}`);
                console.error(`Localpart: ${localpart}`);
            }
        }
        
        return { statusCode: 200, body: 'Emails processed successfully' };
    } catch (error) {
        console.error('Error processing email:', error);
        console.error('Stack:', error.stack);
        throw error;
    }
};

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

