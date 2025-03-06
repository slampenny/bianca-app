import React from 'react'
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'

// Dummy data for payment methods
const dummyPaymentMethods = [
  { id: '1', type: 'Credit Card', brand: 'Visa', last4: '4242' },
  { id: '2', type: 'PayPal', email: 'user@example.com' },
]

// Dummy billing info
const billingInfo = {
  currentPlan: 'Premium',
  nextBillingDate: '2025-03-01',
  pastInvoices: [
    { id: 'inv1', date: '2025-01-01', amount: '$9.99' },
    { id: 'inv2', date: '2024-12-01', amount: '$9.99' },
  ],
}

function PaymentMethodsScreen() {
  const renderMethod = ({ item }: { item: any }) => (
    <View style={styles.methodCard}>
      <Text style={styles.methodText}>
        {item.type === 'Credit Card'
          ? `${item.brand} **** ${item.last4}`
          : `PayPal: ${item.email}`}
      </Text>
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
        data={dummyPaymentMethods}
        keyExtractor={(item) => item.id}
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
  return (
    <View style={styles.screenContainer}>
      <Text style={styles.billingHeader}>Current Plan: {billingInfo.currentPlan}</Text>
      <Text style={styles.billingHeader}>Next Billing Date: {billingInfo.nextBillingDate}</Text>
      <Text style={styles.sectionTitle}>Past Invoices:</Text>
      {billingInfo.pastInvoices.map((invoice) => (
        <View key={invoice.id} style={styles.invoiceCard}>
          <Text style={styles.invoiceText}>
            {invoice.date} - {invoice.amount}
          </Text>
        </View>
      ))}
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
        indicatorStyle: { backgroundColor: '#3498db' },
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
    padding: 16,
    borderRadius: 6,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    // Android elevation
    elevation: 2,
  },
  methodText: {
    fontSize: 16,
    color: '#2c3e50',
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
  invoiceCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    // Android elevation
    elevation: 2,
  },
  invoiceText: {
    fontSize: 14,
    color: '#2c3e50',
  },
})

export default PaymentInfoScreen
