const express = require('express');
const { body, validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');
const { protect, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Create supplier
router.post('/', protect, checkPermission('manage_suppliers'), [
  body('name').notEmpty().withMessage('Supplier name is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const supplier = new Supplier({
      ...req.body,
      storeId: req.user.storeId
    });

    await supplier.save();
    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// List suppliers
router.get('/', protect, async (req, res) => {
  try {
    const { skip = 0, limit = 50 } = req.query;
    
    const suppliers = await Supplier.find({ storeId: req.user.storeId, isActive: true })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Supplier.countDocuments({ storeId: req.user.storeId, isActive: true });

    res.json({
      success: true,
      count: suppliers.length,
      total,
      data: suppliers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get supplier
router.get('/:id', protect, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate('itemsSupplied');

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update supplier
router.put('/:id', protect, checkPermission('manage_suppliers'), async (req, res) => {
  try {
    let supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete supplier (soft delete)
router.delete('/:id', protect, checkPermission('manage_suppliers'), async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, 
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;