const express = require('express');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const { protect, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Get restricted drug logs
router.get('/restricted-drugs', protect, checkPermission('manage_compliance'), async (req, res) => {
  try {
    const { startDate, endDate, drugSchedule } = req.query;
    
    // Get restricted items
    let itemQuery = {
      storeId: req.user.storeId,
      drugSchedule: { $in: ['Schedule H', 'Schedule H1', 'Schedule X'] }
    };
    
    if (drugSchedule) {
      itemQuery.drugSchedule = drugSchedule;
    }

    const restrictedItems = await Item.find(itemQuery);
    const restrictedItemIds = restrictedItems.map(item => item._id);

    // Get transactions containing restricted items
    let txnQuery = {
      storeId: req.user.storeId,
      'items.itemId': { $in: restrictedItemIds }
    };

    if (startDate || endDate) {
      txnQuery.createdAt = {};
      if (startDate) txnQuery.createdAt.$gte = new Date(startDate);
      if (endDate) txnQuery.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(txnQuery)
      .populate('cashierId', 'name email role')
      .populate('items.itemId');

    const logs = transactions.map(txn => ({
      transactionId: txn.transactionId,
      date: txn.createdAt,
      cashier: {
        name: txn.cashierId.name,
        email: txn.cashierId.email
      },
      restrictedItems: txn.items.filter(item => 
        restrictedItemIds.includes(item.itemId)
      ),
      customerInfo: {
        name: txn.customerName,
        phone: txn.customerPhone
      },
      requiresApproval: !txn.restrictedDrugApproval
    }));

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve restricted drug sale
router.post('/approve/:transactionId', protect, checkPermission('manage_compliance'), async (req, res) => {
  try {
    const { notes } = req.body;

    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    transaction.restrictedDrugApproval = {
      pharmacistId: req.user._id,
      approvalDate: new Date(),
      approvalNotes: notes
    };

    await transaction.save();

    res.json({
      success: true,
      message: 'Restricted drug sale approved',
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get audit trail for a transaction
router.get('/audit/:transactionId', protect, checkPermission('manage_compliance'), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId)
      .populate('cashierId', 'name email role')
      .populate('items.itemId');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const auditTrail = {
      transactionId: transaction.transactionId,
      createdAt: transaction.createdAt,
      cashier: {
        id: transaction.cashierId._id,
        name: transaction.cashierId.name,
        email: transaction.cashierId.email,
        role: transaction.cashierId.role
      },
      items: transaction.items,
      paymentMethod: transaction.paymentMethod,
      totalAmount: transaction.totalAmount,
      taxAmount: transaction.taxAmount,
      restrictedDrugApproval: transaction.restrictedDrugApproval,
      refunded: transaction.refunded,
      refundReason: transaction.refundReason
    };

    res.json({
      success: true,
      data: auditTrail
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Expiry date alerts
router.get('/expiry-alerts', protect, checkPermission('manage_compliance'), async (req, res) => {
  try {
    const { daysThreshold = 30 } = req.query;

    const today = new Date();
    const alertDate = new Date();
    alertDate.setDate(today.getDate() + parseInt(daysThreshold));

    const items = await Item.find({
      storeId: req.user.storeId,
      'batches.expiryDate': { 
        $gte: today,
        $lte: alertDate
      }
    });

    const alerts = items.map(item => ({
      itemId: item._id,
      itemName: item.name,
      sku: item.sku,
      batches: item.batches.filter(batch => 
        batch.expiryDate >= today && batch.expiryDate <= alertDate
      )
    }));

    res.json({
      success: true,
      count: alerts.length,
      daysThreshold: parseInt(daysThreshold),
      data: alerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;