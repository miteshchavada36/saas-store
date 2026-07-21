const express = require('express');
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const { protect, checkPermission } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const router = express.Router();

// Create transaction
router.post('/transaction', protect, checkPermission('process_billing'), [
  body('items').isArray().withMessage('Items must be an array'),
  body('paymentMethod').isIn(['Cash', 'UPI', 'Card', 'Cheque']).withMessage('Invalid payment method')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { items, paymentMethod, customerName, customerPhone, customerEmail, totalDiscount = 0 } = req.body;

    let subtotal = 0;
    let totalTax = 0;
    const transactionItems = [];

    // Process items
    for (let item of items) {
      const dbItem = await Item.findById(item.itemId);
      if (!dbItem) {
        return res.status(404).json({ error: `Item ${item.itemId} not found` });
      }

      // Check stock
      if (dbItem.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${dbItem.name}` });
      }

      const itemTotal = dbItem.sellingPrice * item.quantity;
      const taxAmount = (itemTotal * dbItem.gstRate) / 100;

      transactionItems.push({
        itemId: dbItem._id,
        itemName: dbItem.name,
        barcode: dbItem.barcode,
        quantity: item.quantity,
        unitPrice: dbItem.sellingPrice,
        itemDiscount: item.discount || 0,
        taxAmount,
        totalAmount: itemTotal + taxAmount - (item.discount || 0)
      });

      subtotal += itemTotal;
      totalTax += taxAmount;

      // Update stock
      dbItem.stock -= item.quantity;
      await dbItem.save();
    }

    const totalAmount = subtotal + totalTax - totalDiscount;

    const transaction = new Transaction({
      storeId: req.user.storeId,
      cashierId: req.user._id,
      items: transactionItems,
      subtotal,
      totalDiscount,
      taxAmount: totalTax,
      totalAmount,
      paymentMethod,
      paymentStatus: 'Completed',
      customerName,
      customerPhone,
      customerEmail
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get transaction
router.get('/transaction/:id', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('cashierId', 'name email')
      .populate('items.itemId');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List transactions
router.get('/transactions', protect, async (req, res) => {
  try {
    const { skip = 0, limit = 50, startDate, endDate } = req.query;
    
    let query = { storeId: req.user.storeId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      count: transactions.length,
      total,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refund transaction
router.post('/transaction/:id/refund', protect, checkPermission('process_billing'), async (req, res) => {
  try {
    const { reason } = req.body;
    
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.refunded) {
      return res.status(400).json({ error: 'Transaction already refunded' });
    }

    // Restore stock
    for (let item of transaction.items) {
      const dbItem = await Item.findById(item.itemId);
      if (dbItem) {
        dbItem.stock += item.quantity;
        await dbItem.save();
      }
    }

    transaction.refunded = true;
    transaction.refundAmount = transaction.totalAmount;
    transaction.refundDate = new Date();
    transaction.refundReason = reason;
    await transaction.save();

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;