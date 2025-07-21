#!/bin/bash

# Audio Pipeline Diagnostic Script
# This script helps diagnose and fix audio pipeline issues

echo "🔍 Audio Pipeline Diagnostic Tool"
echo "=================================="

# Check if call ID is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <call_id>"
    echo "Example: $0 CA2341535ffcee9821b1502762eba54351"
    exit 1
fi

CALL_ID="$1"
BASE_URL="http://localhost:3000/api/v1/test"

echo "📞 Diagnosing call: $CALL_ID"
echo ""

# Step 1: Run comprehensive diagnostic
echo "🔍 Step 1: Running comprehensive diagnostic..."
DIAGNOSTIC_RESPONSE=$(curl -s -X POST "$BASE_URL/audio-pipeline-diagnostic/$CALL_ID")

if [ $? -ne 0 ]; then
    echo "❌ Failed to connect to diagnostic endpoint"
    exit 1
fi

echo "$DIAGNOSTIC_RESPONSE" | jq '.' 2>/dev/null || echo "$DIAGNOSTIC_RESPONSE"
echo ""

# Extract issues from diagnostic
ISSUES=$(echo "$DIAGNOSTIC_RESPONSE" | jq -r '.issues[]?' 2>/dev/null)

if [ -n "$ISSUES" ]; then
    echo "🚨 Issues found:"
    echo "$ISSUES" | while read -r issue; do
        echo "  - $issue"
    done
    echo ""
    
    # Check if RTP sender needs fixing
    if echo "$ISSUES" | grep -q "No RTP sender found"; then
        echo "🔧 Step 2: Fixing RTP sender..."
        FIX_RESPONSE=$(curl -s -X POST "$BASE_URL/fix-rtp-sender/$CALL_ID")
        
        if [ $? -eq 0 ]; then
            echo "$FIX_RESPONSE" | jq '.' 2>/dev/null || echo "$FIX_RESPONSE"
            
            # Check if fix was successful
            SUCCESS=$(echo "$FIX_RESPONSE" | jq -r '.success' 2>/dev/null)
            if [ "$SUCCESS" = "true" ]; then
                echo "✅ RTP sender fix successful!"
            else
                echo "❌ RTP sender fix failed"
            fi
        else
            echo "❌ Failed to fix RTP sender"
        fi
        echo ""
    fi
    
    # Check for OpenAI buffer errors
    if echo "$ISSUES" | grep -q "OpenAI has consecutive buffer errors"; then
        echo "⚠️  OpenAI has buffer errors - this may require manual intervention"
        echo "   Consider restarting the OpenAI connection for this call"
        echo ""
    fi
    
    # Run final diagnostic
    echo "🔍 Step 3: Running final diagnostic..."
    FINAL_DIAGNOSTIC=$(curl -s -X POST "$BASE_URL/audio-pipeline-diagnostic/$CALL_ID")
    
    FINAL_ISSUES=$(echo "$FINAL_DIAGNOSTIC" | jq -r '.issues[]?' 2>/dev/null)
    if [ -z "$FINAL_ISSUES" ]; then
        echo "✅ All issues resolved!"
    else
        echo "⚠️  Remaining issues:"
        echo "$FINAL_ISSUES" | while read -r issue; do
            echo "  - $issue"
        done
    fi
    
else
    echo "✅ No issues found - audio pipeline appears to be working correctly"
fi

echo ""
echo "📊 Summary:"
echo "  - Call ID: $CALL_ID"
echo "  - Diagnostic endpoint: $BASE_URL/audio-pipeline-diagnostic/$CALL_ID"
echo "  - Fix endpoint: $BASE_URL/fix-rtp-sender/$CALL_ID"
echo ""
echo "💡 Additional debugging tips:"
echo "  - Check logs for 'RTP Sender' and 'OpenAI Realtime' messages"
echo "  - Monitor network connectivity between app and Asterisk"
echo "  - Verify RTP port ranges are not conflicting"
echo "  - Check if Asterisk is properly configured for RTP" 