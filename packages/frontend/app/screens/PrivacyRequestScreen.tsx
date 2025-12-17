import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  View,
  Platform,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { Text, TextField, Button } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { useLanguage } from "app/hooks/useLanguage"
import {
  useCreateAccessRequestMutation,
  useCreateCorrectionRequestMutation,
  useCreateComplaintMutation,
  useRequestDataDeletionMutation,
  useGetPrivacyRequestsQuery,
  useGetComplaintsQuery,
} from "../services/api/privacyApi"
import { useToast } from "../hooks/useToast"
import Toast from "../components/Toast"
import { logger } from "../utils/logger"
import { Screen } from "../components/Screen"
import { testingProps } from "../utils/testingProps"
import ConfirmationModal from "../components/ConfirmationModal"

export const PrivacyRequestScreen = () => {
  const navigation = useNavigation()
  const { colors, isLoading: themeLoading, fontScale } = useTheme()
  useLanguage() // Trigger re-render on language change
  const { toast, showInfo, hideToast } = useToast()
  
  const [requestType, setRequestType] = useState<"access" | "correction" | "complaint">("access")
  const [informationRequested, setInformationRequested] = useState("All my personal information")
  // Access method is always "email" - we email the data as a JSON attachment
  const accessMethod: "email" = "email"
  
  // Correction request fields
  const [correctionField, setCorrectionField] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [requestedValue, setRequestedValue] = useState("")
  const [correctionReason, setCorrectionReason] = useState("")
  
  // Complaint request fields
  const [complaintSubject, setComplaintSubject] = useState("")
  const [complaintDescription, setComplaintDescription] = useState("")
  const [violationType, setViolationType] = useState<"unauthorized_access" | "unauthorized_disclosure" | "incorrect_information" | "denied_access" | "denied_correction" | "consent_issue" | "retention_issue" | "breach_notification" | "complaint_handling" | "other">("other")
  
  const [createAccessRequest, { isLoading: isSubmittingAccess }] = useCreateAccessRequestMutation()
  const [createCorrectionRequest, { isLoading: isSubmittingCorrection }] = useCreateCorrectionRequestMutation()
  const [createComplaint, { isLoading: isSubmittingComplaint }] = useCreateComplaintMutation()
  const [requestDataDeletion, { isLoading: isDeletingData }] = useRequestDataDeletionMutation()
  
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteDataType, setDeleteDataType] = useState<"all" | "calls" | "conversations" | "medicalAnalysis">("all")
  
  const isSubmitting = isSubmittingAccess || isSubmittingCorrection || isSubmittingComplaint || isDeletingData
  const { data: requestsData, refetch: refetchRequests, isLoading: isLoadingRequests } = useGetPrivacyRequestsQuery({
    page: 1,
    limit: 10,
  })
  const { data: complaintsData, refetch: refetchComplaints, isLoading: isLoadingComplaints } = useGetComplaintsQuery({
    page: 1,
    limit: 10,
  })

  const handleSubmit = async () => {
    try {
      if (requestType === "access") {
        const result = await createAccessRequest({
          informationRequested: informationRequested || "All my personal information",
          accessMethod: "email", // Always email - sends JSON attachment
        }).unwrap()
        
        logger.info("[PrivacyRequestScreen] Access request created:", result)
        showInfo(translate("privacyRequestScreen.requestSubmitted") || "Your data request has been submitted. You will receive an email with your data shortly.")
        
        // Clear form
        setInformationRequested("All my personal information")
      } else if (requestType === "correction") {
        // Correction request
        if (!correctionField || !requestedValue) {
          showInfo(translate("privacyRequestScreen.correctionFieldsRequired") || "Please fill in all required fields.")
          return
        }
        
        const result = await createCorrectionRequest({
          informationRequested: informationRequested || `Correction to ${correctionField}`,
          correctionDetails: {
            field: correctionField,
            currentValue: currentValue || "Not specified",
            requestedValue: requestedValue,
            reason: correctionReason || "User requested correction",
          },
        }).unwrap()
        
        logger.info("[PrivacyRequestScreen] Correction request created:", result)
        showInfo(translate("privacyRequestScreen.correctionRequestSubmitted") || "Your correction request has been submitted. We will review and process it within 30 days.")
        
        // Clear form
        setCorrectionField("")
        setCurrentValue("")
        setRequestedValue("")
        setCorrectionReason("")
        setInformationRequested("")
      } else {
        // Complaint request
        if (!complaintSubject || !complaintDescription) {
          showInfo(translate("privacyRequestScreen.complaintFieldsRequired") || "Please fill in subject and description.")
          return
        }
        
        const result = await createComplaint({
          subject: complaintSubject,
          description: complaintDescription,
          violationType: violationType,
        }).unwrap()
        
        logger.info("[PrivacyRequestScreen] Complaint created:", result)
        showInfo(translate("privacyRequestScreen.complaintSubmitted") || "Your complaint has been submitted. We will investigate and respond within 30 days.")
        
        // Clear form
        setComplaintSubject("")
        setComplaintDescription("")
        setViolationType("other")
      }
      
      // RTK Query should automatically refetch when tags are invalidated,
      // but we also manually refetch to ensure the UI updates immediately
      // The mutation's invalidatesTags should trigger a refetch, but we do it manually
      // to ensure it happens even if there's a timing issue
      await Promise.resolve() // Ensure mutation completes
      refetchRequests()
      refetchComplaints()
    } catch (error: any) {
      logger.error(`[PrivacyRequestScreen] Error creating ${requestType} request:`, error)
      const errorMessage = error?.data?.message || translate("privacyRequestScreen.requestFailed") || "Failed to submit request. Please try again."
      showInfo(errorMessage)
    }
  }

  const handleDeleteRequest = () => {
    setShowDeleteConfirmation(true)
  }

  const handleConfirmDeletion = async () => {
    try {
      const result = await requestDataDeletion({
        dataType: deleteDataType,
      }).unwrap()
      
      logger.info("[PrivacyRequestScreen] Data deletion completed:", result)
      showInfo(translate("privacyRequestScreen.deletionCompleted") || `Successfully deleted ${result.deleted.total || 0} items.`)
      
      setShowDeleteConfirmation(false)
      setDeleteDataType("all")
    } catch (error: any) {
      logger.error("[PrivacyRequestScreen] Error deleting data:", error)
      const errorMessage = error?.data?.message || translate("privacyRequestScreen.deletionFailed") || "Failed to delete data. Please try again or contact support."
      showInfo(errorMessage)
      setShowDeleteConfirmation(false)
    }
  }

  const handleCancelDeletion = () => {
    setShowDeleteConfirmation(false)
  }

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors, fontScale)
  const requests = requestsData?.results || []
  const complaints = complaintsData?.results || []

  return (
    <>
      <Screen
        preset="scroll"
        style={styles.container}
        testID="privacy-request-screen"
        {...testingProps("privacy-request-screen")}
        accessibilityLabel="privacy-request-screen"
        ScrollViewProps={{
          contentContainerStyle: styles.scrollContent,
          showsVerticalScrollIndicator: true,
        }}
      >
          <View style={styles.header}>
            <Text style={styles.subtitle} tx="privacyRequestScreen.subtitle" />
          </View>

          {/* Request Type Selector */}
          <View style={styles.requestTypeSelector}>
            <Button
              text={translate("privacyRequestScreen.requestTypeAccess") || "Access Request"}
              onPress={() => setRequestType("access")}
              preset={requestType === "access" ? "primary" : "default"}
              style={styles.typeButton}
              testID="request-type-access"
              accessibilityLabel="request-type-access"
            />
            <Button
              text={translate("privacyRequestScreen.requestTypeCorrection") || "Correction Request"}
              onPress={() => setRequestType("correction")}
              preset={requestType === "correction" ? "primary" : "default"}
              style={styles.typeButton}
              testID="request-type-correction"
              accessibilityLabel="request-type-correction"
            />
            <Button
              text={translate("privacyRequestScreen.requestTypeComplaint") || "File Complaint"}
              onPress={() => setRequestType("complaint")}
              preset={requestType === "complaint" ? "primary" : "default"}
              style={styles.typeButton}
              testID="request-type-complaint"
              accessibilityLabel="request-type-complaint"
            />
          </View>

          <View style={styles.formCard}>
            {requestType === "access" ? (
              <>
                <Text style={styles.sectionDescription} tx="privacyRequestScreen.requestDataDescription" />
              </>
            ) : requestType === "correction" ? (
              <>
                <Text style={styles.sectionTitle} tx="privacyRequestScreen.correctionRequestTitle" />
                <Text style={styles.sectionDescription} tx="privacyRequestScreen.correctionRequestDescription" />
                <Text style={styles.infoText}>
                  {translate("privacyRequestScreen.correctionNote") || "Note: Most data can be edited directly in the app. Use this form for data that cannot be edited, such as historical logs or system-generated records."}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle} tx="privacyRequestScreen.complaintRequestTitle" />
                <Text style={styles.sectionDescription} tx="privacyRequestScreen.complaintRequestDescription" />
              </>
            )}

            {requestType === "access" ? (
              <>
                <View style={styles.fieldContainer}>
                  <TextField
                    placeholderTx="privacyRequestScreen.informationRequestedPlaceholder"
                    labelTx="privacyRequestScreen.informationRequestedLabel"
                    value={informationRequested}
                    onChangeText={setInformationRequested}
                    multiline
                    numberOfLines={4}
                    style={styles.textArea}
                    containerStyle={styles.inputContainer}
                    inputWrapperStyle={styles.inputWrapper}
                  />
                </View>

                <Text style={styles.infoText}>
                  {translate("privacyRequestScreen.accessMethodInfo") || "Your data will be emailed to you as a JSON file attachment."}
                </Text>
              </>
            ) : requestType === "correction" ? (
              <>
                <View style={styles.fieldContainer}>
                  <TextField
                    placeholderTx="privacyRequestScreen.correctionFieldPlaceholder"
                    labelTx="privacyRequestScreen.correctionFieldLabel"
                    value={correctionField}
                    onChangeText={setCorrectionField}
                    containerStyle={styles.inputContainer}
                    inputWrapperStyle={styles.inputWrapper}
                    testID="correction-field-input"
                    accessibilityLabel="correction-field-input"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <TextField
                    placeholderTx="privacyRequestScreen.currentValuePlaceholder"
                    labelTx="privacyRequestScreen.currentValueLabel"
                    value={currentValue}
                    onChangeText={setCurrentValue}
                    containerStyle={styles.inputContainer}
                    inputWrapperStyle={styles.inputWrapper}
                    testID="current-value-input"
                    accessibilityLabel="current-value-input"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <TextField
                    placeholderTx="privacyRequestScreen.requestedValuePlaceholder"
                    labelTx="privacyRequestScreen.requestedValueLabel"
                    value={requestedValue}
                    onChangeText={setRequestedValue}
                    containerStyle={styles.inputContainer}
                    inputWrapperStyle={styles.inputWrapper}
                    testID="requested-value-input"
                    accessibilityLabel="requested-value-input"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <TextField
                    placeholderTx="privacyRequestScreen.correctionReasonPlaceholder"
                    labelTx="privacyRequestScreen.correctionReasonLabel"
                    value={correctionReason}
                    onChangeText={setCorrectionReason}
                    multiline
                    numberOfLines={4}
                    style={styles.textArea}
                    containerStyle={styles.inputContainer}
                    inputWrapperStyle={styles.inputWrapper}
                    testID="correction-reason-input"
                    accessibilityLabel="correction-reason-input"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <TextField
                    placeholderTx="privacyRequestScreen.informationRequestedPlaceholder"
                    labelTx="privacyRequestScreen.additionalInformationLabel"
                    value={informationRequested}
                    onChangeText={setInformationRequested}
                    multiline
                    numberOfLines={3}
                    style={styles.textArea}
                    containerStyle={styles.inputContainer}
                    inputWrapperStyle={styles.inputWrapper}
                    testID="correction-additional-info-input"
                    accessibilityLabel="correction-additional-info-input"
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.fieldContainer}>
                  <TextField
                    placeholderTx="privacyRequestScreen.complaintSubjectPlaceholder"
                    labelTx="privacyRequestScreen.complaintSubjectLabel"
                    value={complaintSubject}
                    onChangeText={setComplaintSubject}
                    containerStyle={styles.inputContainer}
                    inputWrapperStyle={styles.inputWrapper}
                    testID="complaint-subject-input"
                    accessibilityLabel="complaint-subject-input"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <TextField
                    placeholderTx="privacyRequestScreen.complaintDescriptionPlaceholder"
                    labelTx="privacyRequestScreen.complaintDescriptionLabel"
                    value={complaintDescription}
                    onChangeText={setComplaintDescription}
                    multiline
                    numberOfLines={6}
                    style={styles.textArea}
                    containerStyle={styles.inputContainer}
                    inputWrapperStyle={styles.inputWrapper}
                    testID="complaint-description-input"
                    accessibilityLabel="complaint-description-input"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.label} tx="privacyRequestScreen.violationTypeLabel" />
                  <View style={styles.radioGroup}>
                    <Button
                      text={translate("privacyRequestScreen.violationTypeOther") || "Other"}
                      onPress={() => setViolationType("other")}
                      preset={violationType === "other" ? "primary" : "default"}
                      style={styles.radioButton}
                      testID="violation-type-other"
                      accessibilityLabel="violation-type-other"
                    />
                    <Button
                      text={translate("privacyRequestScreen.violationTypeAccess") || "Access Issue"}
                      onPress={() => setViolationType("denied_access")}
                      preset={violationType === "denied_access" ? "primary" : "default"}
                      style={styles.radioButton}
                      testID="violation-type-access"
                      accessibilityLabel="violation-type-access"
                    />
                  </View>
                </View>
              </>
            )}

            <Button
              text={translate("privacyRequestScreen.submitRequest") || "Submit Request"}
              onPress={handleSubmit}
              preset="primary"
              disabled={isSubmitting}
              loading={isSubmitting}
              style={styles.submitButton}
              testID="submit-privacy-request-button"
              accessibilityLabel="submit-privacy-request-button"
            />
          </View>

          {requests.length > 0 && (
            <View style={styles.requestsCard}>
              <Text style={styles.sectionTitle} tx="privacyRequestScreen.requestHistoryTitle" />
              {requests.map((request) => (
                <View key={request._id || request.id} style={styles.requestItem}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestType}>
                      {request.requestType === "access"
                        ? translate("privacyRequestScreen.requestTypeAccess") || "Access Request"
                        : translate("privacyRequestScreen.requestTypeCorrection") || "Correction Request"}
                    </Text>
                    <Text
                      style={[
                        styles.requestStatus,
                        request.status === "completed" && styles.statusCompleted,
                        request.status === "pending" && styles.statusPending,
                        request.status === "processing" && styles.statusProcessing,
                      ]}
                    >
                      {request.status}
                    </Text>
                  </View>
                  <Text style={styles.requestInfo}>{request.informationRequested}</Text>
                  {request.requestType === "correction" && request.correctionDetails && (
                    <View style={styles.correctionDetails}>
                      <Text style={styles.correctionDetailText}>
                        <Text style={styles.correctionLabel}>{translate("privacyRequestScreen.field") || "Field"}: </Text>
                        {request.correctionDetails.field}
                      </Text>
                      <Text style={styles.correctionDetailText}>
                        <Text style={styles.correctionLabel}>{translate("privacyRequestScreen.currentValue") || "Current"}: </Text>
                        {request.correctionDetails.currentValue}
                      </Text>
                      <Text style={styles.correctionDetailText}>
                        <Text style={styles.correctionLabel}>{translate("privacyRequestScreen.requestedValue") || "Requested"}: </Text>
                        {request.correctionDetails.requestedValue}
                      </Text>
                      {request.correctionDetails.reason && (
                        <Text style={styles.correctionDetailText}>
                          <Text style={styles.correctionLabel}>{translate("privacyRequestScreen.reason") || "Reason"}: </Text>
                          {request.correctionDetails.reason}
                        </Text>
                      )}
                    </View>
                  )}
                  {request.requestDate && (
                    <Text style={styles.requestDate}>
                      {translate("privacyRequestScreen.requestedOn") || "Requested on"}:{" "}
                      {new Date(request.requestDate).toLocaleDateString()}
                    </Text>
                  )}
                  {request.responseDate && (
                    <Text style={styles.requestDate}>
                      {translate("privacyRequestScreen.completedOn") || "Completed on"}:{" "}
                      {new Date(request.responseDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {(isLoadingRequests || isLoadingComplaints) && (
            <Text style={styles.loadingText} tx="common.loading" />
          )}

          {/* Data Deletion Section */}
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle} tx="privacyRequestScreen.deletionRequestTitle" />
            <Text style={styles.sectionDescription} tx="privacyRequestScreen.deletionRequestDescription" />
            
            <View style={styles.fieldContainer}>
              <Text style={styles.label} tx="privacyRequestScreen.deletionDataTypeLabel" />
              <View style={styles.radioGroup}>
                <Button
                  text={translate("privacyRequestScreen.deletionTypeAll") || "All Data"}
                  onPress={() => setDeleteDataType("all")}
                  preset={deleteDataType === "all" ? "primary" : "default"}
                  style={styles.radioButton}
                  testID="deletion-type-all"
                  accessibilityLabel="deletion-type-all"
                />
                <Button
                  text={translate("privacyRequestScreen.deletionTypeCalls") || "Calls Only"}
                  onPress={() => setDeleteDataType("calls")}
                  preset={deleteDataType === "calls" ? "primary" : "default"}
                  style={styles.radioButton}
                  testID="deletion-type-calls"
                  accessibilityLabel="deletion-type-calls"
                />
              </View>
            </View>

            <Button
              text={translate("privacyRequestScreen.requestDeletion") || "Request Data Deletion"}
              onPress={handleDeleteRequest}
              preset="default"
              disabled={isDeletingData}
              loading={isDeletingData}
              style={[styles.submitButton, styles.deleteButton]}
              testID="request-deletion-button"
              accessibilityLabel="request-deletion-button"
            />
          </View>

          {complaints.length > 0 && (
            <View style={styles.requestsCard}>
              <Text style={styles.sectionTitle} tx="privacyRequestScreen.complaintHistoryTitle" />
              {complaints.map((complaint) => (
                <View key={complaint._id || complaint.id} style={styles.requestItem}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestType}>
                      {translate("privacyRequestScreen.requestTypeComplaint") || "Complaint"}
                    </Text>
                    <Text
                      style={[
                        styles.requestStatus,
                        complaint.status === "resolved" && styles.statusCompleted,
                        complaint.status === "submitted" && styles.statusPending,
                        complaint.status === "investigating" && styles.statusProcessing,
                      ]}
                    >
                      {complaint.status}
                    </Text>
                  </View>
                  <Text style={styles.requestInfo}>{complaint.subject}</Text>
                  {complaint.complaintDate && (
                    <Text style={styles.requestDate}>
                      {translate("privacyRequestScreen.filedOn") || "Filed on"}:{" "}
                      {new Date(complaint.complaintDate).toLocaleDateString()}
                    </Text>
                  )}
                  {complaint.resolvedAt && (
                    <Text style={styles.requestDate}>
                      {translate("privacyRequestScreen.resolvedOn") || "Resolved on"}:{" "}
                      {new Date(complaint.resolvedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
      </Screen>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        testID="privacy-request-toast"
      />
      <ConfirmationModal
        visible={showDeleteConfirmation}
        title={translate("privacyRequestScreen.deletionConfirmTitle") || "Confirm Data Deletion"}
        message={translate("privacyRequestScreen.deletionConfirmMessage") || "This will permanently delete your data. This action cannot be undone. Are you sure you want to proceed?"}
        confirmText={translate("privacyRequestScreen.confirmDelete") || "Delete"}
        cancelText={translate("common.cancel") || "Cancel"}
        onConfirm={handleConfirmDeletion}
        onCancel={handleCancelDeletion}
        testID="deletion-confirmation-modal"
      />
    </>
  )
}

const createStyles = (colors: any, fontScale: number) => StyleSheet.create({
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40, // Extra padding at bottom for better scrolling
  },
  header: {
    marginBottom: 20,
  },
  requestTypeSelector: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  typeButton: {
    flex: 1,
    minWidth: 100,
  },
  title: {
    color: colors.palette.biancaHeader,
    fontSize: 24 * fontScale,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.text,
    fontSize: 16 * fontScale,
    textAlign: "center",
    opacity: 0.7,
    marginBottom: 20,
  },
  infoText: {
    color: colors.text,
    fontSize: 14 * fontScale,
    opacity: 0.8,
    fontStyle: "italic",
    marginTop: 10,
    marginBottom: 10,
  },
  formCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 20,
    padding: 20,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 18 * fontScale,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionDescription: {
    color: colors.text,
    fontSize: 14 * fontScale,
    marginBottom: 20,
    opacity: 0.7,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 0,
  },
  inputWrapper: {
    // TextField handles styling
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  label: {
    color: colors.text,
    fontSize: 16 * fontScale,
    fontWeight: "500",
    marginBottom: 10,
  },
  radioGroup: {
    flexDirection: "row",
    gap: 10,
  },
  radioButton: {
    flex: 1,
  },
  submitButton: {
    marginTop: 10,
  },
  deleteButton: {
    backgroundColor: colors.palette.angry500 || "#ef4444",
  },
  requestsCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 20,
    padding: 20,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  requestItem: {
    borderBottomColor: colors.palette.neutral300,
    borderBottomWidth: 1,
    marginBottom: 15,
    paddingBottom: 15,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  requestType: {
    color: colors.palette.biancaHeader,
    fontSize: 16 * fontScale,
    fontWeight: "600",
  },
  requestStatus: {
    fontSize: 14 * fontScale,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  statusCompleted: {
    color: colors.palette.biancaSuccess || "#10b981",
  },
  statusPending: {
    color: colors.palette.biancaWarning || "#f59e0b",
  },
  statusProcessing: {
    color: colors.palette.biancaButtonSelected || "#3b82f6",
  },
  requestInfo: {
    color: colors.text,
    fontSize: 14 * fontScale,
    marginBottom: 8,
  },
  requestDate: {
    color: colors.text,
    fontSize: 12 * fontScale,
    opacity: 0.6,
  },
  loadingText: {
    color: colors.text,
    fontSize: 14 * fontScale,
    textAlign: "center",
    opacity: 0.6,
  },
  correctionDetails: {
    backgroundColor: colors.palette.neutral200 || colors.palette.neutral100,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
  },
  correctionDetailText: {
    color: colors.text,
    fontSize: 14 * fontScale,
    marginBottom: 4,
  },
  correctionLabel: {
    fontWeight: "600",
    color: colors.palette.biancaHeader,
  },
})


