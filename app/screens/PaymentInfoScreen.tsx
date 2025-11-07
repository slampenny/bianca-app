import React, { useState, useEffect } from "react"
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native"
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs"
import { useSelector } from "react-redux"
// Import getCurrentUser selector here
import { getCurrentUser, getAuthTokens } from "../store/authSlice"
import { getOrg } from "../store/orgSlice"
import { useGetInvoicesByOrgQuery, useGetUnbilledCostsByOrgQuery } from "../services/api/paymentApi"
import { WebView } from "react-native-webview"
import { translate } from "../i18n"
import Config from "../config"
import { spacing } from "app/theme"
import { useTheme } from "app/theme/ThemeContext"
import { Text, Card, ListItem, Button, Icon } from "app/components"
import StripePayment from "app/components/StripePayment"

// --- Define the required roles ---
const AUTHORIZED_ROLES = ["orgAdmin", "superAdmin"]

// --- Helper functions ---
const getInvoiceStatusInfo = (status: string, colors: any) => {
  switch (status?.toLowerCase()) {
    case 'paid':
      return { color: colors.palette.accent500, icon: 'check' as const, label: translate("paymentScreen.paid") }
    case 'pending':
      return { color: colors.palette.secondary300, icon: 'view' as const, label: translate("paymentScreen.pending") }
    case 'overdue':
      return { color: colors.palette.angry500, icon: 'x' as const, label: translate("paymentScreen.overdue") }
    case 'processing':
      return { color: colors.palette.secondary500, icon: 'more' as const, label: translate("paymentScreen.processing") }
    default:
      return { color: colors.palette.neutral500, icon: 'more' as const, label: status || translate("paymentScreen.unknown") }
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

const formatDate = (dateString: string, options?: Intl.DateTimeFormatOptions) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  })
}

// ================================================
//         Invoice Components
// ================================================

// Status Badge Component
function InvoiceStatusBadge({ status, colors, styles }: { status: string; colors: any; styles: any }) {
  const statusInfo = getInvoiceStatusInfo(status, colors)
  
  return (
    <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}15` }]}>
      <Icon 
        icon={statusInfo.icon} 
        size={12} 
        color={statusInfo.color} 
        style={styles.statusIcon}
      />
      <Text 
        style={[styles.statusText, { color: statusInfo.color }]}
        size="xs"
      >
        {statusInfo.label}
      </Text>
    </View>
  )
}

// Latest Invoice Card Component
function LatestInvoiceCard({ invoice }: { invoice: any }) {
  const { colors } = useTheme()
  const styles = createStyles(colors)
  if (!invoice) return null
  
  return (
    <Card
      preset="default"
      style={styles.latestInvoiceCard}
      heading={translate("paymentScreen.latestInvoice")}
      HeadingComponent={
        <View style={styles.latestInvoiceHeader}>
          <Text preset="subheading" style={styles.latestInvoiceTitle}>
            {translate("paymentScreen.latestInvoice")}
          </Text>
          <InvoiceStatusBadge status={invoice.status} colors={colors} styles={styles} />
        </View>
      }
      ContentComponent={
        <View style={styles.latestInvoiceContent}>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>{translate("paymentScreen.amount")}</Text>
            <Text preset="bold" style={styles.invoiceAmount}>
              {formatCurrency(invoice.totalAmount)}
            </Text>
          </View>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>{translate("paymentScreen.invoiceNumber")}</Text>
            <Text style={styles.invoiceValue}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>{translate("paymentScreen.issueDate")}</Text>
            <Text style={styles.invoiceValue}>{formatDate(invoice.issueDate)}</Text>
          </View>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>{translate("paymentScreen.dueDate")}</Text>
            <Text style={styles.invoiceValue}>{formatDate(invoice.dueDate)}</Text>
          </View>
          {invoice.notes && (
            <View style={styles.invoiceNotesContainer}>
              <Text style={styles.invoiceLabel}>{translate("paymentScreen.notes")}</Text>
              <Text style={styles.invoiceNotes}>{invoice.notes}</Text>
            </View>
          )}
        </View>
      }
    />
  )
}

// ================================================
//         PaymentMethodsScreen (Updated to use native Stripe components)
// ================================================
function PaymentMethodsScreen() {
  const org = useSelector(getOrg)
  const tokens = useSelector(getAuthTokens)
  const jwt = tokens?.access?.token
  const { colors, isLoading: themeLoading } = useTheme()
  const styles = createStyles(colors)

  if (!org || !org.id) {
    return (
      <View style={styles.screenContainer} testID="payment-methods-container">
        <Text style={styles.emptyText}>{translate("paymentScreen.noOrganizationData")}</Text>
      </View>
    )
  }

  if (!jwt) {
    return (
      <View style={styles.screenContainer} testID="payment-methods-container">
        <Text style={styles.emptyText}>{translate("paymentScreen.authorizationTokenNotAvailable")}</Text>
      </View>
    )
  }

  const orgId = org.id.toString()

  const handlePaymentMethodAdded = () => {
    // Refresh payment methods or show success message
    console.log('Payment method added successfully')
  }

  const handleError = (error: string) => {
    console.error('Payment error:', error)
    // You could show a toast or alert here
  }

  return (
    <View style={styles.screenContainer} testID="payment-methods-container">
      <StripePayment
        orgId={orgId}
        onPaymentMethodAdded={handlePaymentMethodAdded}
        onError={handleError}
      />
    </View>
  )
}

// ================================================
//         ExpandableInvoice Component
// ================================================
function ExpandableInvoice({ invoice }: { invoice: any }) {
  const [expanded, setExpanded] = useState(false)
  const { colors, isLoading: themeLoading } = useTheme()
  const styles = createStyles(colors)
  
  return (
    <ListItem
      testID={`invoice-container-${invoice.id}`}
      onPress={() => setExpanded((prev) => !prev)}
      style={styles.invoiceListItem}
      LeftComponent={
        <View style={styles.invoiceLeftContent}>
          <Text preset="bold" style={styles.invoiceHistoryDate}>
            {formatDate(invoice.issueDate)}
          </Text>
          <Text preset="bold" style={styles.invoiceHistoryAmount}>
            {formatCurrency(invoice.totalAmount)}
          </Text>
        </View>
      }
      RightComponent={
        <View style={styles.invoiceRightContent}>
          <InvoiceStatusBadge status={invoice.status} colors={colors} styles={styles} />
          <Icon 
            icon={expanded ? "caretLeft" : "caretRight"} 
            size={16} 
            color={colors.palette.neutral500}
            style={styles.expandIcon}
          />
        </View>
      }
      bottomSeparator={expanded}
    >
      {expanded && (
        <View style={styles.invoiceExpandedDetails} testID={`invoice-details-${invoice.id}`}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{translate("paymentScreen.invoiceNumber")}</Text>
            <Text style={styles.detailValue}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{translate("paymentScreen.issueDate")}</Text>
            <Text style={styles.detailValue}>{formatDate(invoice.issueDate, { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{translate("paymentScreen.dueDate")}</Text>
            <Text style={styles.detailValue}>{formatDate(invoice.dueDate, { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}</Text>
          </View>
          {invoice.notes && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{translate("paymentScreen.notes")}</Text>
              <Text style={styles.detailValue}>{invoice.notes}</Text>
            </View>
          )}
        </View>
      )}
    </ListItem>
  )
}

// ================================================
//         CurrentChargesScreen
// ================================================
function CurrentChargesScreen() {
  const org = useSelector(getOrg)
  const { colors, isLoading: themeLoading } = useTheme()
  const styles = createStyles(colors)
  
  if (!org || !org.id) {
    return (
      <View style={styles.screenContainer} testID="current-charges-container">
        <Text style={styles.emptyText}>{translate("paymentScreen.noOrganizationData")}</Text>
      </View>
    )
  }

  const queryParam = { orgId: org.id.toString(), days: 30 } // Last 30 days
  const {
    data: unbilledCosts,
    error: unbilledCostsError,
    isLoading: unbilledCostsLoading,
  } = useGetUnbilledCostsByOrgQuery(queryParam, { skip: !org })

  useEffect(() => {
    if (unbilledCostsError) {
      console.error("Error loading unbilled costs", unbilledCostsError)
    }
  }, [unbilledCostsError])

  if (unbilledCostsLoading) {
    return (
      <View style={[styles.screenContainer, styles.centered]} testID="current-charges-container">
        <ActivityIndicator size="large" color={colors.palette.secondary500} testID="charges-loading-indicator" />
      </View>
    )
  }

  if (unbilledCostsError) {
    return (
      <View style={styles.screenContainer} testID="current-charges-container">
        <Text style={styles.emptyText}>{translate("paymentScreen.errorLoadingCurrentCharges")}</Text>
      </View>
    )
  }

  if (!unbilledCosts || unbilledCosts.patientCosts.length === 0) {
    return (
      <View style={styles.screenContainer} testID="current-charges-container">
        <Card
          preset="default"
          style={styles.emptyChargesCard}
          ContentComponent={
            <View style={styles.emptyChargesContent}>
              <Icon 
                icon="check" 
                size={48} 
                color={colors.palette.accent500}
                style={styles.emptyChargesIcon}
              />
              <Text preset="subheading" style={styles.emptyChargesTitle}>
                {translate("paymentScreen.noPendingCharges")}
              </Text>
              <Text style={styles.emptyChargesMessage} testID="no-charges-text">
                {translate("paymentScreen.allConversationsBilled")}
              </Text>
            </View>
          }
        />
      </View>
    )
  }

  return (
    <View style={styles.screenContainer} testID="current-charges-container">
      {/* Summary Card */}
      <Card
        preset="default"
        style={styles.chargesSummaryCard}
        heading={translate("paymentScreen.currentChargesSummary")}
        ContentComponent={
          <View style={styles.chargesSummaryContent}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{translate("paymentScreen.totalUnbilledAmount")}</Text>
              <Text preset="bold" style={styles.summaryAmount}>
                {formatCurrency(unbilledCosts.totalUnbilledCost)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{translate("paymentScreen.period")}</Text>
              <Text style={styles.summaryValue}>
                {unbilledCosts.period.days} {unbilledCosts.period.days !== 1 ? translate("paymentScreen.days") : translate("paymentScreen.day")}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{translate("paymentScreen.patientsWithCharges")}</Text>
              <Text style={styles.summaryValue}>
                {unbilledCosts.patientCosts.length} {unbilledCosts.patientCosts.length !== 1 ? translate("paymentScreen.patients") : translate("paymentScreen.patient")}
              </Text>
            </View>
          </View>
        }
      />

      {/* Patient Charges List */}
      <View style={styles.patientChargesSection}>
        <Text preset="subheading" style={styles.patientChargesTitle}>
          {translate("paymentScreen.chargesByPatient")}
        </Text>
        <FlatList
          data={unbilledCosts.patientCosts}
          keyExtractor={(item) => item.patientId}
          renderItem={({ item }) => (
            <Card
              preset="default"
              style={styles.patientChargeCard}
              ContentComponent={
                <View style={styles.patientChargeContent}>
                  <View style={styles.patientChargeHeader}>
                    <Text preset="bold" style={styles.patientName}>
                      {item.patientName}
                    </Text>
                    <Text preset="bold" style={styles.patientTotalCost}>
                      {formatCurrency(item.totalCost)}
                    </Text>
                  </View>
                  <View style={styles.patientChargeDetails}>
                    <Text style={styles.patientChargeDetail}>
                      {item.conversationCount} {item.conversationCount !== 1 ? translate("paymentScreen.conversations") : translate("paymentScreen.conversation")}
                    </Text>
                    <Text style={styles.patientChargeDetail}>
                      {translate("paymentScreen.average")} {formatCurrency(item.totalCost / item.conversationCount)}
                    </Text>
                  </View>
                </View>
              }
            />
          )}
          contentContainerStyle={styles.patientChargesList}
          testID="patient-charges-list"
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  )
}

// ================================================
//         BillingInfoScreen (No changes needed here, but keep user check for safety)
// ================================================
function BillingInfoScreen() {
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false)
  const { colors, isLoading: themeLoading } = useTheme()
  const styles = createStyles(colors)
  
  // Keep this check as a safety measure in case this screen is somehow accessed directly
  const currentUser = useSelector(getCurrentUser)
  const org = useSelector(getOrg)

  // Although the parent checks authorization, keep these basic checks
  if (!currentUser) {
    return (
      <View style={styles.screenContainer} testID="billing-info-container">
        <Text style={styles.emptyText}>{translate("paymentScreen.noUserData")}</Text>
      </View>
    )
  }
  if (!org || !org.id) {
    return (
      <View style={styles.screenContainer} testID="billing-info-container">
        <Text style={styles.emptyText}>{translate("paymentScreen.noOrganizationData")}</Text>
      </View>
    )
  }

  const queryParam = { orgId: org.id.toString() }
  const {
    data: invoices,
    error: invoicesError,
    isLoading: invoicesLoading,
  } = useGetInvoicesByOrgQuery(queryParam, { skip: !org })

  // Plan information - these fields don't exist in Org model yet, using fallbacks
  const currentPlan = (org as any).planName || translate("paymentScreen.basicPlan") // TODO: Add planName field to Org model
  const nextBillingDate = (org as any).nextBillingDate 
    ? formatDate((org as any).nextBillingDate)
    : translate("paymentScreen.contactSupport") // TODO: Add nextBillingDate field to Org model

  useEffect(() => {
    if (invoicesError) {
      console.error("Error loading invoices", invoicesError)
    }
  }, [invoicesError])

  if (invoicesLoading) {
    return (
      <View style={[styles.screenContainer, styles.centered]} testID="billing-info-container">
        <ActivityIndicator size="large" color={colors.palette.secondary500} testID="billing-loading-indicator" />
      </View>
    )
  }

  if (invoicesError) {
    // Check specific error before assuming !invoices means error
    return (
      <View style={styles.screenContainer} testID="billing-info-container">
        <Text style={styles.emptyText}>{translate("paymentScreen.errorLoadingCurrentCharges")}</Text>
      </View>
    )
  }

  // Sort invoices by date (most recent first) and get the latest one
  const sortedInvoices = invoices ? [...invoices].sort((a, b) => 
    new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
  ) : []
  
  const latestInvoice = sortedInvoices[0]
  const previousInvoices = sortedInvoices.slice(1)

  return (
    <View style={styles.screenContainer} testID="billing-info-container">
      {/* Plan Information */}
      <Card 
        preset="default" 
        style={styles.planInfoCard}
        ContentComponent={
          <View style={styles.planInfoContent}>
            <View style={styles.planInfoRow}>
              <Text style={styles.planInfoLabel}>{translate("paymentScreen.currentPlan")}</Text>
              <Text preset="bold" style={styles.planInfoValue}>{currentPlan}</Text>
            </View>
            <View style={styles.planInfoRow}>
              <Text style={styles.planInfoLabel}>{translate("paymentScreen.nextBillingDate")}</Text>
              <Text preset="bold" style={styles.planInfoValue}>{nextBillingDate}</Text>
            </View>
          </View>
        }
      />

      {/* Latest Invoice */}
      {latestInvoice && (
        <LatestInvoiceCard invoice={latestInvoice} />
      )}

      {/* Total Billed Amount Summary */}
      {sortedInvoices.length > 0 && (
        <Card
          preset="default"
          style={styles.totalBilledCard}
          ContentComponent={
            <View style={styles.totalBilledContent}>
              <View style={styles.totalBilledHeader}>
                <Text preset="subheading" style={styles.totalBilledTitle}>
                  {translate("paymentScreen.totalBilledAmount")}
                </Text>
                <Text preset="bold" style={styles.totalBilledAmount}>
                  {formatCurrency(sortedInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0))}
                </Text>
              </View>
              <Text style={styles.totalBilledSubtext}>
                {translate("paymentScreen.acrossInvoices")
                  .replace("{count}", sortedInvoices.length.toString())
                  .replace("{s}", sortedInvoices.length !== 1 ? 's' : '')}
              </Text>
            </View>
          }
        />
      )}

      {/* Invoice History Section */}
      {previousInvoices.length > 0 && (
        <View style={styles.invoiceHistorySection}>
          <View style={styles.invoiceHistoryHeader}>
            <Text preset="subheading" style={styles.invoiceHistoryTitle}>
              {translate("paymentScreen.invoiceHistory").replace("{count}", previousInvoices.length.toString())}
            </Text>
            <Button
              preset="default"
              style={styles.toggleHistoryButton}
              onPress={() => setShowInvoiceHistory(!showInvoiceHistory)}
              testID="toggle-invoice-history"
            >
              <Text size="sm" style={styles.toggleHistoryText}>
                {showInvoiceHistory ? translate("paymentScreen.hide") : translate("paymentScreen.show")} {translate("paymentScreen.history")}
              </Text>
              <Icon 
                icon={showInvoiceHistory ? "caretLeft" : "caretRight"} 
                size={14} 
                color={colors.palette.neutral600}
                style={styles.toggleHistoryIcon}
              />
            </Button>
          </View>
          
          {showInvoiceHistory && (
            <FlatList
              data={previousInvoices}
              keyExtractor={(invoice) => invoice.id.toString()}
              renderItem={({ item }) => <ExpandableInvoice invoice={item} />}
              contentContainerStyle={styles.invoiceHistoryList}
              testID="invoices-history-list"
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* Empty State */}
      {!latestInvoice && (
        <Card
          preset="default"
          style={styles.emptyInvoiceCard}
          ContentComponent={
            <View style={styles.emptyInvoiceContent}>
              <Icon 
                icon="view" 
                size={48} 
                color={colors.palette.neutral400}
                style={styles.emptyInvoiceIcon}
              />
              <Text preset="subheading" style={styles.emptyInvoiceTitle}>
                {translate("paymentScreen.noInvoicesYet")}
              </Text>
              <Text style={styles.emptyInvoiceMessage} testID="no-invoices-text">
                {translate("paymentScreen.invoicesWillAppear")}
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

// ================================================
//         Main PaymentInfoScreen (with Role Check)
// ================================================
const Tab = createMaterialTopTabNavigator()

export function PaymentInfoScreen() {
  // Ensure this is the component used in your navigation stack

  // *** 1. Get the current user in the main component ***
  const currentUser = useSelector(getCurrentUser)
  const { colors, isLoading: themeLoading } = useTheme()

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  // *** 2. Handle loading state for user ***
  if (!currentUser) {
    // Show a loading indicator or a generic message while user data is loading
    return (
      <View style={[styles.screenContainer, styles.centered]} testID="payment-info-container">
        <ActivityIndicator size="large" color={colors.palette.primary500} />
        <Text style={styles.emptyText}>{translate("paymentScreen.loadingUserInformation")}</Text>
      </View>
    )
  }

  // *** 3. Check user role ***
  const userRole = currentUser.role // Assuming role is a property on the user object
  const isAuthorized = AUTHORIZED_ROLES.includes(userRole)

  // *** 4. Conditional Rendering based on Role ***
  if (!isAuthorized) {
    // User is NOT authorized - Show the message
    return (
      <View style={styles.messageContainer} testID="payment-info-container">
        <Text style={styles.messageTitle} testID="access-restricted-title">{translate("paymentScreen.accessRestricted")}</Text>
        <Text style={styles.messageText} testID="access-restricted-message">
          {translate("paymentScreen.accessRestrictedMessage")}
        </Text>
        <Text style={styles.messageText}>
          {translate("paymentScreen.contactAdministrator")}
        </Text>
      </View>
    )
  }

  // *** 5. User IS authorized - Render the Tab Navigator ***
  return (
    <View style={styles.mainContainer} testID="payment-info-container">
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: colors.palette.biancaButtonSelected,
            tabBarInactiveTintColor: colors.palette.neutral600,
            tabBarLabelStyle: { fontSize: 16, fontWeight: "600" },
            tabBarStyle: { backgroundColor: colors.palette.neutral100 },
            tabBarIndicatorStyle: { backgroundColor: colors.palette.biancaButtonSelected },
          }}
          testID="payment-tabs-navigator"
        >
        <Tab.Screen 
          name={translate("paymentScreen.currentCharges")} 
          component={CurrentChargesScreen}
          options={{
            tabBarTestID: "current-charges-tab"
          }}
        />
        <Tab.Screen 
          name={translate("paymentScreen.paymentMethods")} 
          component={PaymentMethodsScreen}
          options={{
            tabBarTestID: "payment-methods-tab"
          }}
        />
        <Tab.Screen 
          name={translate("paymentScreen.billingInfo")} 
          component={BillingInfoScreen}
          options={{
            tabBarTestID: "billing-info-tab"
          }}
        />
        </Tab.Navigator>
      </ScrollView>
    </View>
  )
}

// --- Styles (Updated for new design) ---
const createStyles = (colors: any) => StyleSheet.create({
  // General styles
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: colors.palette.neutral600,
    fontSize: 15,
    marginTop: 20,
    textAlign: "center",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: colors.palette.neutral200,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.palette.neutral200,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  webview: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.palette.neutral400,
  },

  // Message/Error styles
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.palette.neutral200,
  },
  messageText: {
    color: colors.palette.neutral700,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  messageTitle: {
    color: colors.palette.angry500,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: spacing.md,
    textAlign: "center",
  },

  // Status Badge styles
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusIcon: {
    marginRight: spacing.xxs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Plan Info Card styles
  planInfoCard: {
    marginBottom: spacing.md,
  },
  planInfoContent: {
    gap: spacing.sm,
  },
  planInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planInfoLabel: {
    color: colors.palette.neutral600,
    fontSize: 16,
  },
  planInfoValue: {
    color: colors.palette.neutral800,
    fontSize: 16,
  },

  // Latest Invoice Card styles
  latestInvoiceCard: {
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.palette.secondary200,
  },

  // Total Billed Card styles
  totalBilledCard: {
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.palette.accent200,
    backgroundColor: colors.palette.accent100,
  },
  totalBilledContent: {
    gap: spacing.xs,
  },
  totalBilledHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalBilledTitle: {
    color: colors.palette.neutral800,
  },
  totalBilledAmount: {
    color: colors.palette.accent500,
    fontSize: 20,
  },
  totalBilledSubtext: {
    color: colors.palette.neutral600,
    fontSize: 14,
    textAlign: "center",
  },
  latestInvoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  latestInvoiceTitle: {
    color: colors.palette.neutral800,
  },
  latestInvoiceContent: {
    gap: spacing.xs,
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xxs,
  },
  invoiceLabel: {
    color: colors.palette.neutral600,
    fontSize: 14,
  },
  invoiceValue: {
    color: colors.palette.neutral800,
    fontSize: 14,
  },
  invoiceAmount: {
    color: colors.palette.secondary500,
    fontSize: 18,
  },
  invoiceNotesContainer: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.palette.neutral300,
  },
  invoiceNotes: {
    color: colors.palette.neutral700,
    fontSize: 14,
    marginTop: spacing.xxs,
    fontStyle: "italic",
  },

  // Invoice History styles
  invoiceHistorySection: {
    marginBottom: spacing.md,
  },
  invoiceHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  invoiceHistoryTitle: {
    color: colors.palette.neutral800,
  },
  toggleHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  toggleHistoryText: {
    color: colors.palette.neutral600,
    marginRight: spacing.xxs,
  },
  toggleHistoryIcon: {
    marginLeft: spacing.xxs,
  },
  invoiceHistoryList: {
    paddingBottom: spacing.sm,
  },

  // Invoice ListItem styles
  invoiceListItem: {
    marginBottom: spacing.xs,
    backgroundColor: colors.palette.neutral100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  invoiceLeftContent: {
    flex: 1,
    gap: spacing.xxs,
  },
  invoiceHistoryDate: {
    color: colors.palette.neutral800,
    fontSize: 16,
  },
  invoiceHistoryAmount: {
    color: colors.palette.secondary500,
    fontSize: 14,
  },
  invoiceRightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  expandIcon: {
    marginLeft: spacing.xs,
  },

  // Expanded invoice details
  invoiceExpandedDetails: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.palette.neutral300,
    backgroundColor: colors.palette.neutral100,
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: spacing.xxs,
  },
  detailLabel: {
    color: colors.palette.neutral600,
    fontSize: 14,
    flex: 1,
    marginRight: spacing.sm,
  },
  detailValue: {
    color: colors.palette.neutral800,
    fontSize: 14,
    flex: 2,
    textAlign: "right",
  },

  // Empty State styles
  emptyInvoiceCard: {
    marginTop: spacing.lg,
  },
  emptyInvoiceContent: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyInvoiceIcon: {
    marginBottom: spacing.xs,
  },
  emptyInvoiceTitle: {
    color: colors.palette.neutral600,
    textAlign: "center",
  },
  emptyInvoiceMessage: {
    color: colors.palette.neutral500,
    textAlign: "center",
    fontSize: 14,
  },

  // Current Charges styles
  chargesSummaryCard: {
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.palette.neutral200,
    borderRadius: 12,
    shadowColor: colors.palette.neutral900,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chargesSummaryContent: {
    gap: spacing.md,
    padding: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.neutral100,
  },
  summaryLabel: {
    color: colors.palette.neutral600,
    fontSize: 16,
    fontWeight: '500',
  },
  summaryValue: {
    color: colors.palette.neutral800,
    fontSize: 16,
    fontWeight: '600',
  },
  summaryAmount: {
    color: colors.palette.secondary500,
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Patient Charges styles
  patientChargesSection: {
    marginBottom: spacing.lg,
  },
  patientChargesTitle: {
    color: colors.palette.neutral800,
    marginBottom: spacing.md,
    fontSize: 18,
    fontWeight: '600',
  },
  patientChargesList: {
    paddingBottom: spacing.sm,
  },
  patientChargeCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.palette.neutral100,
    borderWidth: 1,
    borderColor: colors.palette.neutral200,
    borderRadius: 8,
    shadowColor: colors.palette.neutral900,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  patientChargeContent: {
    gap: spacing.sm,
    padding: spacing.sm,
  },
  patientChargeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.neutral100,
  },
  patientName: {
    color: colors.palette.neutral800,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  patientTotalCost: {
    color: colors.palette.secondary500,
    fontSize: 18,
    fontWeight: 'bold',
  },
  patientChargeDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xs,
  },
  patientChargeDetail: {
    color: colors.palette.neutral600,
    fontSize: 14,
    fontWeight: '500',
  },

  // Empty Charges styles
  emptyChargesCard: {
    marginTop: spacing.lg,
  },
  emptyChargesContent: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyChargesIcon: {
    marginBottom: spacing.xs,
  },
  emptyChargesTitle: {
    color: colors.palette.accent500,
    textAlign: "center",
  },
  emptyChargesMessage: {
    color: colors.palette.neutral500,
    textAlign: "center",
    fontSize: 14,
  },
})

// Optional: If PaymentInfoScreen is the default export of the file
// export default PaymentInfoScreen;
