const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Items
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item'
    },
    itemName: String,
    barcode: String,
    quantity: Number,
    unitPrice: Number,
    itemDiscount: Number,
    taxAmount: Number,
    batchNumber: String,
    totalAmount: Number
  }],
  
  // Totals
  subtotal: Number,
  totalDiscount: {
    type: Number,
    default: 0
  },
  taxAmount: Number,
  totalAmount: Number,
  
  // Payment
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Cheque'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Completed', 'Pending', 'Failed'],
    default: 'Completed'
  },
  paymentReference: String,
  
  // Customer
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  
  // Compliance
  invoiceNumber: {
    type: String,
    unique: true
  },
  gstNumber: String,
  restrictedDrugApproval: {
    pharmacistId: mongoose.Schema.Types.ObjectId,
    approvalDate: Date,
    approvalNotes: String
  },
  
  // Receipt
  invoiceGenerated: {
    type: Boolean,
    default: false
  },
  pdfPath: String,
  emailSent: {
    type: Boolean,
    default: false
  },
  whatsappSent: {
    type: Boolean,
    default: false
  },
  
  // Refund (if applicable)
  refunded: {
    type: Boolean,
    default: false
  },
  refundAmount: Number,
  refundDate: Date,
  refundReason: String,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate transaction ID
TransactionSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    this.transactionId = `TXN-${timestamp}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Transaction', TransactionSchema);