const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true
  },
  barcode: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: ['Medicines', 'Supplements', 'Medical Devices', 'Wellness', 'Other'],
    default: 'Medicines'
  },
  manufacturer: String,
  
  // Pricing
  purchasePrice: {
    type: Number,
    required: true
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  mrp: {
    type: Number,
    required: true
  },
  
  // Tax
  gstRate: {
    type: Number,
    default: 18
  },
  
  // Stock Management
  stock: {
    type: Number,
    required: true,
    default: 0
  },
  reorderLevel: Number,
  reorderQuantity: Number,
  
  // Batch Management
  batches: [{
    batchNumber: String,
    quantity: Number,
    expiryDate: Date,
    purchaseDate: Date,
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    }
  }],
  
  // Pharmacy Compliance
  drugSchedule: {
    type: String,
    enum: ['OTC', 'Schedule H', 'Schedule H1', 'Schedule X', 'Other'],
    default: 'OTC'
  },
  requiresPrescription: {
    type: Boolean,
    default: false
  },
  prescriptionTags: [String],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isExpired: {
    type: Boolean,
    default: false
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

// Calculate profit margin
ItemSchema.methods.getProfitMargin = function() {
  return ((this.sellingPrice - this.purchasePrice) / this.purchasePrice) * 100;
};

// Check if item is low on stock
ItemSchema.methods.isLowStock = function() {
  return this.stock <= this.reorderLevel;
};

// Check expiry status
ItemSchema.methods.checkExpiry = function() {
  const today = new Date();
  this.batches.forEach(batch => {
    if (batch.expiryDate < today) {
      this.isExpired = true;
    }
  });
};

module.exports = mongoose.model('Item', ItemSchema);