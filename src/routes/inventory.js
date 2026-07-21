const express = require('express');
const { body, validationResult } = require('express-validator');
const Item = require('../models/Item');
const { protect, authorize, checkPermission } = require('../middleware/auth');
const csv = require('csv-parser');
const fs = require('fs');

const router = express.Router();

// Create item
router.post('/item', protect, checkPermission('manage_inventory'), [
  body('sku').notEmpty().withMessage('SKU is required'),
  body('barcode').notEmpty().withMessage('Barcode is required'),
  body('name').notEmpty().withMessage('Item name is required'),
  body('purchasePrice').isNumeric().withMessage('Purchase price must be numeric'),
  body('sellingPrice').isNumeric().withMessage('Selling price must be numeric'),
  body('mrp').isNumeric().withMessage('MRP must be numeric')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const item = new Item({
      ...req.body,
      storeId: req.user.storeId
    });

    await item.save();
    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Search item by barcode/SKU
router.get('/item', protect, async (req, res) => {
  try {
    const { barcode, sku } = req.query;
    
    let query = { storeId: req.user.storeId, isActive: true };
    if (barcode) query.barcode = barcode;
    if (sku) query.sku = sku;

    const item = await Item.findOne(query);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all items
router.get('/items', protect, async (req, res) => {
  try {
    const { skip = 0, limit = 50, category } = req.query;
    
    let query = { storeId: req.user.storeId, isActive: true };
    if (category) query.category = category;

    const items = await Item.find(query)
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Item.countDocuments(query);

    res.json({
      success: true,
      count: items.length,
      total,
      data: items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update item
router.put('/item/:id', protect, checkPermission('manage_inventory'), async (req, res) => {
  try {
    let item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    item = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add stock
router.post('/item/:id/stock', protect, checkPermission('manage_inventory'), async (req, res) => {
  try {
    const { quantity, batchNumber, expiryDate, supplierId } = req.body;

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Add batch
    item.batches.push({
      batchNumber,
      quantity,
      expiryDate,
      supplierId,
      purchaseDate: new Date()
    });

    item.stock += quantity;
    await item.save();

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get low stock items
router.get('/low-stock', protect, async (req, res) => {
  try {
    const items = await Item.find({
      storeId: req.user.storeId,
      $expr: { $lte: ['$stock', '$reorderLevel'] }
    });

    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get expired items
router.get('/expired', protect, async (req, res) => {
  try {
    const today = new Date();
    
    const items = await Item.find({
      storeId: req.user.storeId,
      'batches.expiryDate': { $lt: today }
    });

    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;