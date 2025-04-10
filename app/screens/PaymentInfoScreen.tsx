import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { useSelector } from 'react-redux'
import { getCurrentUser } from '../store/authSlice'
import { getOrg } from 'app/store/orgSlice'
import { useGetPaymentMethodsQuery } from 'app/services/api/paymentMethodApi'
import { useGetInvoicesByOrgQuery } from 'app/services/api/paymentApi'

function ExpandableInvoice({ invoice }: { invoice: any }) {
  const [expanded, setExpanded] = useState(false)
  const formattedDate = new Date(invoice.issueDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(invoice.totalAmount)

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
  )
}

function PaymentMethodsScreen() {
  const currentUser = useSelector(getCurrentUser)
  const org = useSelector(getOrg)

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

  const orgId: string = org.id.toString()
  const {
    data: paymentMethods,
    error: paymentMethodsError,
    isLoading: paymentMethodsLoading,
  } = useGetPaymentMethodsQuery(orgId)

  if (paymentMethodsLoading) {
    return (
      <View style={styles.screenContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    )
  }

  let methods: any[] = paymentMethods || []
  if (paymentMethodsError) {
    if ('status' in paymentMethodsError && paymentMethodsError.status !== 404) {
      return (
        <View style={styles.screenContainer}>
          <Text style={styles.emptyText}>
            Error loading payment methods: {JSON.stringify(paymentMethodsError)}
          </Text>
        </View>
      )
    }
    methods = []
  }

  const renderMethod = ({ item }: { item: any }) => (
    <View style={styles.methodCard}>
      <View style={styles.methodContent}>
        <Text style={styles.methodIcon}>
          {item.type === 'card' ? '💳' : '🅿️'}
        </Text>
        <View style={styles.methodDetails}>
          <Text style={styles.methodTitle}>
            {item.type === 'card'
              ? `${item.brand ?? 'Card'} **** ${item.last4 ?? '----'}`
              : `PayPal: ${item.email ?? 'N/A'}`}
          </Text>
          {item.isDefault && (
            <Text style={styles.methodSubTitle}>Default Payment Method</Text>
          )}
        </View>
      </View>
      <Pressable
        style={styles.editButton}
        onPress={() => console.log('Edit payment method', item)}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
    </View>
  )

  return (
    <View style={styles.screenContainer}>
      <FlatList
        data={methods}
        keyExtractor={item =>
          item.id ? item.id.toString() : Math.random().toString()
        }
        renderItem={renderMethod}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No payment methods available</Text>
        }
      />
      <Pressable
        style={styles.addButton}
        onPress={() => console.log('Add payment method')}
      >
        <Text style={styles.addButtonText}>Add Payment Method</Text>
      </Pressable>
    </View>
  )
}

function BillingInfoScreen() {
  const currentUser = useSelector(getCurrentUser)
  const org = useSelector(getOrg)

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

  const queryParam = { orgId: org ? org.id.toString() : '' };
  const {
    data: invoices,
    error: invoicesError,
    isLoading: invoicesLoading,
  } = useGetInvoicesByOrgQuery(queryParam, { skip: !org })

  const currentPlan = 'Premium'
  const nextBillingDate = '2025-03-01'

  if (invoicesLoading) {
    return (
      <View style={styles.screenContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    )
  }

  if (invoicesError || !invoices) {
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
        keyExtractor={invoice => invoice.id.toString()}
        renderItem={({ item }) => <ExpandableInvoice invoice={item} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No invoices available.</Text>
        }
      />
    </View>
  )
}

const Tab = createMaterialTopTabNavigator()

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
  )
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ecf0f1',
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  methodCard: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  methodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  methodDetails: {
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  methodSubTitle: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  editButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 20,
  },
  addButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
  invoiceText: {
    fontSize: 14,
    color: '#2c3e50',
  },
})

export default PaymentInfoScreen
