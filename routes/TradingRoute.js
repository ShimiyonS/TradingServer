// routes/TradingRoute.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TradingRegistration = require('../models/TradingRegistration');

const router = express.Router();

// Create uploads directory if it doesn't exist
const createUploadsDir = () => {
  const uploadDirs = [
    'uploads',
    'uploads/aadhar',
    'uploads/signatures'
  ];
  
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadsDir();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'uploads/';
    
    // Determine upload path based on field name
    switch (file.fieldname) {
      case 'aadharFile':
        uploadPath += 'aadhar/';
        break;
        case 'signatureFile':
        uploadPath += 'signatures/';
        break;
      default:
        uploadPath += 'misc/';
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'aadharFile': /jpeg|jpg|png|pdf/,
    'signatureFile': /jpeg|jpg|png/
  };
  
  const fileType = allowedTypes[file.fieldname] || /jpeg|jpg|png|pdf/;
  const extname = fileType.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileType.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Only ${fileType.source} files are allowed.`));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Upload fields configuration
const uploadFields = upload.fields([
  { name: 'aadharFile', maxCount: 1 },
  { name: 'signatureFile', maxCount: 1 }
]);

// Error handling function
const handleRegistrationErrors = (error) => {
  const errors = {};
  
  if (error.name === 'ValidationError') {
    // Handle Mongoose validation errors
    Object.keys(error.errors).forEach(key => {
      errors[key] = error.errors[key].message;
    });
  } else if (error.name === 'MongoServerError' && error.code === 11000) {
    // Handle duplicate key errors
    const field = Object.keys(error.keyPattern)[0];
    errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists. Please use a different ${field}.`;
  } else if (error.message.includes('already exists')) {
    errors.general = error.message;
  } else if (error.message.includes('Invalid file type')) {
    errors.file = error.message;
  } else {
    errors.general = error.message || 'An unexpected error occurred. Please try again.';
  }
  
  return errors;
};

// Helper function to format file data for database
const formatFileData = (file) => {
  if (!file) return null;
  
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path
  };
};

// @route   POST /api/trading-registration
// @desc    Create new trading registration
// @access  Public
router.post('/', uploadFields, async (req, res) => {
  try {
    console.log('📝 Registration Request Received');
    console.log('Body:', req.body);
    console.log('Files:', req.files);

    // Prepare registration data
    const registrationData = { ...req.body };

    // Add file data to registration
    if (req.files) {
      if (req.files.aadharFile) {
        registrationData.aadharFile = formatFileData(req.files.aadharFile[0]);
      }
        if (req.files.signatureFile) {
        registrationData.signatureFile = formatFileData(req.files.signatureFile[0]);
      }
    }

    // Create new registration
    const registration = new TradingRegistration(registrationData);
    await registration.save();

    console.log('✅ Registration Created Successfully:', registration._id);

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully!',
      data: {
        id: registration._id,
        fullName: registration.fullName,
        email: registration.email,
        registrationStatus: registration.registrationStatus,
        submissionDate: registration.submissionDate
      }
    });

  } catch (error) {
    console.error('❌ Registration Error:', error);
    
    // Clean up uploaded files if registration fails
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    const errors = handleRegistrationErrors(error);
    res.status(400).json({
      success: false,
      message: 'Registration failed',
      errors: errors
    });
  }
});

// @route   GET /api/trading-registration
// @desc    Get all registrations (with pagination and filters)
// @access  Private (Admin)
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'submissionDate',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};
    
    if (status) {
      query.registrationStatus = status;
    }
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const registrations = await TradingRegistration
      .find(query)
      .select('-aadharFile -panFile -signatureFile') // Exclude file data for list view
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TradingRegistration.countDocuments(query);

    res.json({
      success: true,
      data: registrations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Get Registrations Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations',
      error: error.message
    });
  }
});

// @route   GET /api/trading-registration/stats
// @desc    Get registration statistics
// @access  Private (Admin)
router.get('/stats', async (req, res) => {
  try {
    const stats = await TradingRegistration.aggregate([
      {
        $group: {
          _id: '$registrationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalRegistrations = await TradingRegistration.countDocuments();
    const todayRegistrations = await TradingRegistration.countDocuments({
      submissionDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });

    const verificationStats = await TradingRegistration.aggregate([
      {
        $project: {
          fullyVerified: {
            $and: [
              '$verificationStatus.aadharVerified',
              '$verificationStatus.signatureVerified',
              '$verificationStatus.emailVerified',
              '$verificationStatus.phoneVerified'
            ]
          }
        }
      },
      {
        $group: {
          _id: '$fullyVerified',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        statusBreakdown: stats,
        totalRegistrations,
        todayRegistrations,
        verificationStats
      }
    });

  } catch (error) {
    console.error('❌ Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});
// @route   GET /api/trading-registration/download/:id/:fileType
// @desc    Download registration files
// @access  Private (Admin)
// router.get('/download/:id/:fileType', async (req, res) => {
//   try {
//     const { id, fileType } = req.params;
    
//     const registration = await TradingRegistration.findById(id);
//     if (!registration) {
//       return res.status(404).json({
//         success: false,
//         message: 'Registration not found'
//       });
//     }

//     let file;
//     switch (fileType) {
//       case 'aadhar':
//         file = registration.aadharFile;
//         break;
//       case 'pan':
//         file = registration.panFile;
//         break;
//       case 'signature':
//         file = registration.signatureFile;
//         break;
//       default:
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid file type'
//         });
//     }

//     if (!file || !fs.existsSync(file.path)) {
//       return res.status(404).json({
//         success: false,
//         message: 'File not found'
//       });
//     }

//     res.download(file.path, file.originalName);

//   } catch (error) {
//     console.error('❌ Download File Error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to download file',
//       error: error.message
//     });
//   }
// });
// @route   GET /api/trading-registration/:id
// @desc    Get single registration by ID
// @access  Private (Admin)
router.get('/:id', async (req, res) => {
  try {
    const registration = await TradingRegistration.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    res.json({
      success: true,
      data: registration
    });

  } catch (error) {
    console.error('❌ Get Registration Error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration',
      error: error.message
    });
  }
});

// @route   PUT /api/trading-registration/:id
// @desc    Update registration
// @access  Private (Admin)
router.put('/:id', uploadFields, async (req, res) => {
  try {
    const registration = await TradingRegistration.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Handle file uploads
    if (req.files) {
      if (req.files.aadharFile) {
        // Delete old file if exists
        if (registration.aadharFile && fs.existsSync(registration.aadharFile.path)) {
          fs.unlinkSync(registration.aadharFile.path);
        }
        updateData.aadharFile = formatFileData(req.files.aadharFile[0]);
      }
      if (req.files.panFile) {
        if (registration.panFile && fs.existsSync(registration.panFile.path)) {
          fs.unlinkSync(registration.panFile.path);
        }
        updateData.panFile = formatFileData(req.files.panFile[0]);
      }
      if (req.files.signatureFile) {
        if (registration.signatureFile && fs.existsSync(registration.signatureFile.path)) {
          fs.unlinkSync(registration.signatureFile.path);
        }
        updateData.signatureFile = formatFileData(req.files.signatureFile[0]);
      }
    }

    // Update registration
    const updatedRegistration = await TradingRegistration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('✅ Registration Updated:', updatedRegistration._id);

    res.json({
      success: true,
      message: 'Registration updated successfully',
      data: updatedRegistration
    });

  } catch (error) {
    console.error('❌ Update Registration Error:', error);
    
    // Clean up uploaded files if update fails
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    const errors = handleRegistrationErrors(error);
    res.status(400).json({
      success: false,
      message: 'Failed to update registration',
      errors: errors
    });
  }
});

// @route   PUT /api/trading-registration/:id/status
// @desc    Update registration status
// @access  Private (Admin)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    
    const validStatuses = ['pending', 'approved', 'rejected', 'under_review'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const registration = await TradingRegistration.findByIdAndUpdate(
      req.params.id,
      { 
        registrationStatus: status,
        ...(adminNotes && { adminNotes })
      },
      { new: true }
    );

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    console.log(`✅ Registration ${registration._id} status updated to: ${status}`);

    res.json({
      success: true,
      message: 'Registration status updated successfully',
      data: {
        id: registration._id,
        status: registration.registrationStatus,
        adminNotes: registration.adminNotes
      }
    });

  } catch (error) {
    console.error('❌ Update Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update registration status',
      error: error.message
    });
  }
});

// @route   PUT /api/trading-registration/:id/verify
// @desc    Update verification status
// @access  Private (Admin)
router.put('/:id/verify', async (req, res) => {
  try {
    const { verificationType, isVerified } = req.body;
    
    const validTypes = ['aadharVerified', 'panVerified', 'signatureVerified', 'emailVerified', 'phoneVerified'];
    if (!validTypes.includes(verificationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification type'
      });
    }

    const updatePath = `verificationStatus.${verificationType}`;
    const registration = await TradingRegistration.findByIdAndUpdate(
      req.params.id,
      { [updatePath]: isVerified },
      { new: true }
    );

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    console.log(`✅ ${verificationType} updated for registration ${registration._id}: ${isVerified}`);

    res.json({
      success: true,
      message: 'Verification status updated successfully',
      data: {
        id: registration._id,
        verificationStatus: registration.verificationStatus,
        isFullyVerified: registration.isFullyVerified()
      }
    });

  } catch (error) {
    console.error('❌ Update Verification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update verification status',
      error: error.message
    });
  }
});

// @route   DELETE /api/trading-registration/:id
// @desc    Delete registration
// @access  Private (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const registration = await TradingRegistration.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Delete associated files
    const filesToDelete = [
      registration.aadharFile?.path,
      registration.panFile?.path,
      registration.signatureFile?.path
    ].filter(Boolean);

    filesToDelete.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    await TradingRegistration.findByIdAndDelete(req.params.id);

    console.log('✅ Registration Deleted:', req.params.id);

    res.json({
      success: true,
      message: 'Registration deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete registration',
      error: error.message
    });
  }
});



module.exports = router;