import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSelector } from 'react-redux';
import { getCurrentUser } from '../store/authSlice';
import { getOrg } from '../store/orgSlice';
import { useGetInvoicesByOrgQuery } from '../services/api/paymentApi';
import { getAuthTokens } from '../store/authSlice';
import { WebView } from 'react-native-webview';
import Config from '../config';

function PaymentMethodsScreen() {
  const org = useSelector(getOrg);
  const tokens = useSelector(getAuthTokens);
  const jwt = tokens?.access?.token;

  if (!org || !org.id) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>No organization data available.</Text>
      </View>
    );
  }

  if (!jwt) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>JWT token not available.</Text>
      </View>
    );
  }

  const orgId = org.id.toString();
  console.log('React Native JWT:', jwt);
  const paymentPageUrl = `${Config.paymentMethodGatewayUrl}/${orgId}/${jwt}`; // Replace with actual token

  return (
    <View style={styles.screenContainer}>
      {Platform.OS === 'web' ? (
        <iframe
          src={paymentPageUrl}
          style={styles.iframe}
          title="Payment Method"
        />
      ) : (
        <WebView
          source={{ uri: paymentPageUrl }}
          style={styles.webview}
        />
      )}
    </View>
  );
}

function ExpandableInvoice({ invoice }: { invoice: any }) {
  const [expanded, setExpanded] = useState(false);
  const formattedDate = new Date(invoice.issueDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(invoice.totalAmount);

  return (
    <View style={styles.invoiceContainer}>
      <Pressable
        onPress={() => setExpanded(prev => !prev)}
        style={styles.invoiceHeader}
      >
        <Text style={styles.invoiceHeaderText}>
          {formattedDate} - {formattedAmount}
        </Text>
        <Text style={styles.expandIcon}>{expanded ? '▲' : '▼'}</Text>
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
          {invoice.notes && (
            <Text style={styles.detailText}>Notes: {invoice.notes}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function BillingInfoScreen() {
  const currentUser = useSelector(getCurrentUser);
  const org = useSelector(getOrg);

  if (!currentUser) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>No user data available.</Text>
      </View>
    );
  }
  if (!org || !org.id) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>No organization data available.</Text>
      </View>
    );
  }

  const queryParam = { orgId: org.id.toString() };
  const {
    data: invoices,
    error: invoicesError,
    isLoading: invoicesLoading,
  } = useGetInvoicesByOrgQuery(queryParam, { skip: !org });

  const currentPlan = 'Premium';
  const nextBillingDate = '2025-03-01';

  useEffect(() => {
    if (invoicesError) {
      console.error('Error loading invoices', invoicesError);
    }
  }, [invoicesError]);

  if (invoicesLoading) {
    return (
      <View style={styles.screenContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  if (invoicesError || !invoices) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>Error loading invoices.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.billingHeader}>Current Plan: {currentPlan}</Text>
      <Text style={styles.billingHeader}>Next Billing Date: {nextBillingDate}</Text>
      <Text style={styles.sectionTitle}>Past Invoices:</Text>
      <FlatList
        data={invoices}
        keyExtractor={invoice => invoice.id.toString()}
        renderItem={({ item }) => <ExpandableInvoice invoice={item} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No invoices available.</Text>
        }
      />
    </View>
  );
}

const Tab = createMaterialTopTabNavigator();

export function PaymentInfoScreen() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: '#7f8c8d',
        tabBarLabelStyle: { fontSize: 16, fontWeight: '600' },
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarIndicatorStyle: { backgroundColor: '#3498db' },
      }}
    >
      <Tab.Screen name="Payment Methods" component={PaymentMethodsScreen} />
      <Tab.Screen name="Billing Info" component={BillingInfoScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ecf0f1',
  },
  webview: {
    flex: 1,
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 20,
  },
  billingHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 20,
    marginBottom: 10,
  },
  invoiceContainer: {
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  invoiceHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
  },
  invoiceHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  expandIcon: {
    fontSize: 16,
    color: '#3498db',
  },
  invoiceDetails: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  detailText: {
    fontSize: 14,
    color: '#2c3e50',
    marginVertical: 2,
  },
});

export default PaymentInfoScreen;
