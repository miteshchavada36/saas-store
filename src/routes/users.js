const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, authorize, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Create user (Admin only)
router.post('/', protect, authorize('Admin'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Email is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['Admin', 'Store Manager', 'Cashier']).withMessage('Invalid role')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, phone, password, role, storeId } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    user = new User({
      name,
      email,
      phone,
      password,
      role,
      storeId: storeId || req.user.storeId
    });

    await user.save();

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all users (Admin/Store Manager)
router.get('/', protect, async (req, res) => {
  try {
    const { skip = 0, limit = 50, role } = req.query;
    
    let query = {};
    
    // Store Managers can only see users in their store
    if (req.user.role === 'Store Manager') {
      query.storeId = req.user.storeId;
    }
    
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-password')
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      count: users.length,
      total,
      data: users
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, phone, role } = req.body;

    // Only Admin can change role
    if (role && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admin can change user role' });
    }

    const updates = { name, phone };
    if (role) updates.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Deactivate user
router.put('/:id/deactivate', protect, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, 
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User deactivated',
      data: user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;