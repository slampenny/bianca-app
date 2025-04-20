import React, { useState, useEffect } from "react"
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native"
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs"
import { useSelector } from "react-redux"
// Import getCurrentUser selector here
import { getCurrentUser, getAuthTokens } from "../store/authSlice"
import { getOrg } from "../store/orgSlice"
import { useGetInvoicesByOrgQuery } from "../services/api/paymentApi"
import { WebView } from "react-native-webview"
import Config from "../config"

// --- Define the required roles ---
const AUTHORIZED_ROLES = ["orgAdmin", "superAdmin"]

// ================================================
//         PaymentMethodsScreen (No changes needed here)
// ================================================
function PaymentMethodsScreen() {
  const org = useSelector(getOrg)
  const tokens = useSelector(getAuthTokens)
  const jwt = tokens?.access?.token

  if (!org || !org.id) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>No organization data available.</Text>
      </View>
    )
  }

  if (!jwt) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>Authorization token not available.</Text>
      </View>
    )
  }

  const orgId = org.id.toString()
  // console.log('React Native JWT:', jwt); // Consider removing in production
  const paymentPageUrl = `${Config.paymentMethodGatewayUrl}/${orgId}/${jwt}`

  return (
    <View style={styles.screenContainer}>
      {Platform.OS === "web" ? (
        <iframe src={paymentPageUrl} style={styles.iframe} title="Payment Method" />
      ) : (
        <WebView
          source={{ uri: paymentPageUrl }}
          style={styles.webview}
          // Add error handling for WebView if needed
          // onError={(syntheticEvent) => {
          //   const { nativeEvent } = syntheticEvent;
          //   console.warn('WebView error: ', nativeEvent);
          // }}
        />
      )}
    </View>
  )
}

// ================================================
//         ExpandableInvoice (No changes needed here)
// ================================================
function ExpandableInvoice({ invoice }: { invoice: any }) {
  const [expanded, setExpanded] = useState(false)
  const formattedDate = new Date(invoice.issueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(invoice.totalAmount)

  return (
    <View style={styles.invoiceContainer}>
      <Pressable onPress={() => setExpanded((prev) => !prev)} style={styles.invoiceHeader}>
        <Text style={styles.invoiceHeaderText}>
          {formattedDate} - {formattedAmount}
        </Text>
        <Text style={styles.expandIcon}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.invoiceDetails}>
          <Text style={styles.detailText}>Invoice Number: {invoice.invoiceNumber}</Text>
          <Text style={styles.detailText}>Status: {invoice.status}</Text>
          <Text style={styles.detailText}>
            Issue Date: {new Date(invoice.issueDate).toLocaleString()}
          </Text>
          <Text style={styles.detailText}>
            Due Date: {new Date(invoice.dueDate).toLocaleString()}
          </Text>
          {invoice.notes && <Text style={styles.detailText}>Notes: {invoice.notes}</Text>}
        </View>
      )}
    </View>
  )
}

// ================================================
//         BillingInfoScreen (No changes needed here, but keep user check for safety)
// ================================================
function BillingInfoScreen() {
  // Keep this check as a safety measure in case this screen is somehow accessed directly
  const currentUser = useSelector(getCurrentUser)
  const org = useSelector(getOrg)

  // Although the parent checks authorization, keep these basic checks
  if (!currentUser) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>No user data available.</Text>
      </View>
    )
  }
  if (!org || !org.id) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>No organization data available.</Text>
      </View>
    )
  }

  const queryParam = { orgId: org.id.toString() }
  const {
    data: invoices,
    error: invoicesError,
    isLoading: invoicesLoading,
  } = useGetInvoicesByOrgQuery(queryParam, { skip: !org })

  // Hardcoded data - consider fetching this from org or user data if available
  const currentPlan = org.planName || "Unknown Plan" // Example: Get plan from org
  const nextBillingDate = org.nextBillingDate || "N/A" // Example: Get next billing date

  useEffect(() => {
    if (invoicesError) {
      console.error("Error loading invoices", invoicesError)
    }
  }, [invoicesError])

  if (invoicesLoading) {
    return (
      <View style={[styles.screenContainer, styles.centered]}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    )
  }

  if (invoicesError) {
    // Check specific error before assuming !invoices means error
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>Error loading invoices.</Text>
      </View>
    )
  }

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.billingHeader}>Current Plan: {currentPlan}</Text>
      <Text style={styles.billingHeader}>Next Billing Date: {nextBillingDate}</Text>
      <Text style={styles.sectionTitle}>Past Invoices:</Text>
      <FlatList
        data={invoices}
        keyExtractor={(invoice) => invoice.id.toString()}
        renderItem={({ item }) => <ExpandableInvoice invoice={item} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No invoices available.</Text>}
      />
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

  // *** 2. Handle loading state for user ***
  if (!currentUser) {
    // Show a loading indicator or a generic message while user data is loading
    return (
      <View style={[styles.screenContainer, styles.centered]}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.emptyText}>Loading user information...</Text>
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
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>Access Restricted</Text>
        <Text style={styles.messageText}>
          You do not have the necessary permissions to view or manage payment information.
        </Text>
        <Text style={styles.messageText}>
          Please contact your organization administrator for assistance.
        </Text>
      </View>
    )
  }

  // *** 5. User IS authorized - Render the Tab Navigator ***
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#3498db",
        tabBarInactiveTintColor: "#7f8c8d",
        tabBarLabelStyle: { fontSize: 16, fontWeight: "600" },
        tabBarStyle: { backgroundColor: "#fff" },
        tabBarIndicatorStyle: { backgroundColor: "#3498db" },
      }}
    >
      <Tab.Screen name="Payment Methods" component={PaymentMethodsScreen} />
      <Tab.Screen name="Billing Info" component={BillingInfoScreen} />
    </Tab.Navigator>
  )
}

// --- Styles (Combined and added message styles) ---
const styles = StyleSheet.create({
  billingHeader: {
    color: "#2c3e50",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  centered: {
    // Utility style for centering content
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  detailText: {
    color: "#2c3e50",
    fontSize: 14,
    marginVertical: 3, // Increased vertical margin
  },
  emptyText: {
    color: "#7f8c8d",
    fontSize: 15,
    marginTop: 20,
    textAlign: "center",
  },
  expandIcon: {
    color: "#3498db",
    fontSize: 16,
  },
  iframe: {
    border: "none",
    height: "100%",
    width: "100%",
  },
  invoiceContainer: {
    backgroundColor: "#fff",
    borderColor: "#e0e0e0",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  invoiceDetails: {
    borderTopColor: "#ecf0f1",
    borderTopWidth: 1,
    padding: 12,
  },
  invoiceHeader: {
    paddingVertical: 14, // Increased padding
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9f9f9", // Lighter header bg
  },
  invoiceHeaderText: {
    color: "#2c3e50",
    fontSize: 16,
    fontWeight: "600",
  },
  messageContainer: {
    // Used for the access restricted message
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "#f0f0f0",
  },
  messageText: {
    color: "#34495e",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
    textAlign: "center",
  },
  messageTitle: {
    color: "#e74c3c",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  screenContainer: {
    // Used by sub-screens
    flex: 1,
    padding: 15, // Slightly reduced padding
    backgroundColor: "#f4f6f8", // Lighter background grey
  },
  sectionTitle: {
    fontSize: 17, // Slightly larger
    fontWeight: "600",
    color: "#34495e", // Darker grey
    marginTop: 20,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 5,
  },
  webview: {
    flex: 1,
    borderWidth: 1, // Add border to see boundaries if needed
    borderColor: "#ccc",
  },
})

// Optional: If PaymentInfoScreen is the default export of the file
// export default PaymentInfoScreen;
