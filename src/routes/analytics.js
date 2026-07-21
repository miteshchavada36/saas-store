const express = require('express');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const { protect, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Daily sales summary
router.get('/daily-summary', protect, checkPermission('view_analytics'), async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

    const transactions = await Transaction.find({
      storeId: req.user.storeId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      paymentStatus: 'Completed'
    });

    const summary = {
      totalTransactions: transactions.length,
      totalRevenue: 0,
      totalTax: 0,
      totalDiscount: 0,
      paymentBreakdown: {}
    };

    transactions.forEach(txn => {
      summary.totalRevenue += txn.totalAmount;
      summary.totalTax += txn.taxAmount;
      summary.totalDiscount += txn.totalDiscount;
      
      if (!summary.paymentBreakdown[txn.paymentMethod]) {
        summary.paymentBreakdown[txn.paymentMethod] = 0;
      }
      summary.paymentBreakdown[txn.paymentMethod] += txn.totalAmount;
    });

    res.json({
      success: true,
      date: queryDate,
      data: summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Profit margin analysis
router.get('/profit-margin', protect, checkPermission('view_analytics'), async (req, res) => {
  try {
    const items = await Item.find({ storeId: req.user.storeId });
    
    let totalCost = 0;
    let totalRevenue = 0;
    let itemBreakdown = [];

    items.forEach(item => {
      if (item.stock > 0) {
        const itemCost = item.purchasePrice * item.stock;
        const itemRevenue = item.sellingPrice * item.stock;
        const margin = ((itemRevenue - itemCost) / itemRevenue) * 100;

        totalCost += itemCost;
        totalRevenue += itemRevenue;

        itemBreakdown.push({
          itemId: item._id,
          itemName: item.name,
          quantity: item.stock,
          cost: itemCost,
          revenue: itemRevenue,
          marginPercentage: margin.toFixed(2)
        });
      }
    });

    const overallMargin = ((totalRevenue - totalCost) / totalRevenue) * 100;

    res.json({
      success: true,
      data: {
        totalCost: totalCost.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        overallMarginPercentage: overallMargin.toFixed(2),
        itemBreakdown
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Top selling items
router.get('/top-sellers', protect, checkPermission('view_analytics'), async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    
    let query = { storeId: req.user.storeId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query);
    
    const itemSales = {};
    transactions.forEach(txn => {
      txn.items.forEach(item => {
        if (!itemSales[item.itemId]) {
          itemSales[item.itemId] = {
            itemName: item.itemName,
            quantity: 0,
            revenue: 0
          };
        }
        itemSales[item.itemId].quantity += item.quantity;
        itemSales[item.itemId].revenue += item.totalAmount;
      });
    });

    const topSellers = Object.values(itemSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      count: topSellers.length,
      data: topSellers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tax liability report
router.get('/tax-liability', protect, checkPermission('view_analytics'), async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const transactions = await Transaction.find({
      storeId: req.user.storeId,
      createdAt: { $gte: startDate, $lte: endDate },
      paymentStatus: 'Completed'
    });

    const taxByRate = {};
    let totalTax = 0;

    transactions.forEach(txn => {
      txn.items.forEach(item => {
        const rate = 18;
        if (!taxByRate[rate]) {
          taxByRate[rate] = 0;
        }
        taxByRate[rate] += item.taxAmount;
        totalTax += item.taxAmount;
      });
    });

    res.json({
      success: true,
      month,
      year,
      data: {
        totalTax: totalTax.toFixed(2),
        taxByRate,
        totalTransactions: transactions.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;