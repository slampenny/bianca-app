const PaymentMethodDTO = (paymentMethod) => {
  if (!paymentMethod) return null;
  
  const { 
    _id, 
    stripePaymentMethodId, 
    org, 
    isDefault, 
    type, 
    brand, 
    last4, 
    expMonth, 
    expYear, 
    bankName, 
    accountType, 
    billingDetails, 
    metadata 
  } = paymentMethod;
  
  const id = _id;
  
  return {
    id,
    stripePaymentMethodId,
    org,
    isDefault,
    type,
    brand,
    last4,
    expMonth,
    expYear,
    bankName,
    accountType,
    // Ensure billingDetails is always an object for API consistency
    billingDetails: billingDetails || {},
    metadata: metadata || {},
  };
};

module.exports = PaymentMethodDTO; 