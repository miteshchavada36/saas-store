const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  contactPerson: String,
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  
  // Payment Terms
  paymentTerms: {
    creditDays: {
      type: Number,
      default: 30
    },
    discountPercentage: Number,
    minimumOrderValue: Number
  },
  
  // Banking Details
  bankAccount: String,
  bankCode: String,
  ifscCode: String,
  
  // Tax Info
  gstNumber: String,
  panNumber: String,
  
  // Relationship
  itemsSupplied: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  }],
  
  totalPurchases: {
    type: Number,
    default: 0
  },
  
  lastOrderDate: Date,
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Supplier', SupplierSchema);