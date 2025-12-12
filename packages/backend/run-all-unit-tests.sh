#!/bin/bash
# Script to run all unit tests one suite at a time

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "Running all unit tests, one suite at a time"
echo "=========================================="
echo ""

# Array of all test files
test_files=(
  "tests/unit/alertDeduplicator.test.js"
  "tests/unit/config/agenda.retry.test.js"
  "tests/unit/controllers/auth.controller.email-verification.test.js"
  "tests/unit/controllers/callWorkflow.controller.test.js"
  "tests/unit/controllers/mfa.controller.test.js"
  "tests/unit/controllers/payment.controller.billing.test.js"
  "tests/unit/controllers/privacy.controller.test.js"
  "tests/unit/conversationContextWindow.concurrent.test.js"
  "tests/unit/conversationContextWindow.test.js"
  "tests/unit/dtos/schedule.dto.test.js"
  "tests/unit/emergencyDetector.test.js"
  "tests/unit/emergencyProcessor.test.js"
  "tests/unit/enhancedAlertDeduplicator.test.js"
  "tests/unit/enhancedEmergencyProcessor.test.js"
  "tests/unit/fraudAbuseDetector.test.js"
  "tests/unit/medicalAnalysis.test.js"
  "tests/unit/medicalAnalysisScheduler.test.js"
  "tests/unit/medicalBaselineComparison.test.js"
  "tests/unit/medicalEdgeCases.test.js"
  "tests/unit/medicalNLP.test.js"
  "tests/unit/medicalPsychiatricDecline.test.js"
  "tests/unit/middlewares/error.test.js"
  "tests/unit/middlewares/minimumNecessary.test.js"
  "tests/unit/middlewares/sessionTimeout.test.js"
  "tests/unit/models/breachLog.model.test.js"
  "tests/unit/models/caregiver.model.test.js"
  "tests/unit/models/consentRecord.model.test.js"
  "tests/unit/models/conversation.model.test.js"
  "tests/unit/models/conversation.retry.test.js"
  "tests/unit/models/invoice.model.test.js"
  "tests/unit/models/org.model.test.js"
  "tests/unit/models/org.retry.test.js"
  "tests/unit/models/patient.model.test.js"
  "tests/unit/models/plugins/paginate.plugin.test.js"
  "tests/unit/models/plugins/toJSON.plugin.test.js"
  "tests/unit/models/privacyRequest.model.test.js"
  "tests/unit/models/schedule.model.test.js"
  "tests/unit/services/agenda.billing.test.js"
  "tests/unit/services/alert.service.test.js"
  "tests/unit/services/ari.client.test.js"
  "tests/unit/services/audio/noise-reduction.service.test.js"
  "tests/unit/services/auth.service.email-verification.test.js"
  "tests/unit/services/breachDetection.service.test.js"
  "tests/unit/services/caregiver.service.test.js"
  "tests/unit/services/conversation.ordering.integration.test.js"
  "tests/unit/services/conversation.ordering.test.js"
  "tests/unit/services/conversation.service.test.js"
  "tests/unit/services/email-verification-url.test.js"
  "tests/unit/services/email.localization.test.js"
  "tests/unit/services/invite.service.test.js"
  "tests/unit/services/medicalAnalysisPipeline.test.js"
  "tests/unit/services/mfa.service.test.js"
  "tests/unit/services/openai.realtime.service.test.js"
  "tests/unit/services/openai.realtime.state-machine.test.js"
  "tests/unit/services/org.service.retry.test.js"
  "tests/unit/services/org.service.test.js"
  "tests/unit/services/patient.service.test.js"
  "tests/unit/services/payment.service.billing.test.js"
  "tests/unit/services/payment.service.test.js"
  "tests/unit/services/paymentMethod.service.test.js"
  "tests/unit/services/privacy.service.test.js"
  "tests/unit/services/rtp.listener.service.test.js"
  "tests/unit/services/rtp.sender.service.test.js"
  "tests/unit/services/schedule.service.test.js"
  "tests/unit/services/smsVerification.service.test.js"
  "tests/unit/services/twilioCall.service.billing.test.js"
  "tests/unit/services/twilioCall.service.retry.test.js"
  "tests/unit/services/twilioSms.service.test.js"
  "tests/unit/utils/timezone.utils.test.js"
)

total=${#test_files[@]}
passed=0
failed=0
failed_files=()

echo "Found $total test suites to run"
echo ""

for i in "${!test_files[@]}"; do
  test_file="${test_files[$i]}"
  test_num=$((i + 1))
  
  echo "=========================================="
  echo "[$test_num/$total] Running: $test_file"
  echo "=========================================="
  
  if yarn test "$test_file"; then
    echo "✅ PASSED: $test_file"
    ((passed++))
  else
    echo "❌ FAILED: $test_file"
    ((failed++))
    failed_files+=("$test_file")
  fi
  
  echo ""
done

echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Total test suites: $total"
echo "Passed: $passed"
echo "Failed: $failed"
echo ""

if [ $failed -gt 0 ]; then
  echo "Failed test suites:"
  for file in "${failed_files[@]}"; do
    echo "  - $file"
  done
  echo ""
  exit 1
else
  echo "✅ All test suites passed!"
  exit 0
fi

