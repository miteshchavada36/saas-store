const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['Admin', 'Store Manager', 'Cashier'],
    default: 'Cashier'
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  },
  permissions: [{
    type: String,
    enum: [
      'manage_users',
      'manage_inventory',
      'manage_suppliers',
      'process_billing',
      'view_analytics',
      'manage_compliance',
      'generate_reports'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  lastLogin: Date,
  activityLog: [{
    action: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    details: mongoose.Schema.Types.Mixed
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Assign permissions based on role
UserSchema.pre('save', function(next) {
  const rolePermissions = {
    'Admin': [
      'manage_users',
      'manage_inventory',
      'manage_suppliers',
      'process_billing',
      'view_analytics',
      'manage_compliance',
      'generate_reports'
    ],
    'Store Manager': [
      'manage_inventory',
      'manage_suppliers',
      'process_billing',
      'view_analytics',
      'manage_compliance',
      'generate_reports'
    ],
    'Cashier': [
      'process_billing',
      'view_analytics'
    ]
  };

  this.permissions = rolePermissions[this.role] || [];
  next();
});

module.exports = mongoose.model('User', UserSchema);