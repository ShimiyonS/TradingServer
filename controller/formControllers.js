const UserForm = require('../models/UserForm');

const submitForm = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone,
      dateOfBirth, address, city, state,
      pincode, aadharNumber, agreeTerms, agreeMarketing
    } = req.body;

    // Files from multer
    const aadharFile = req.files?.aadharFile?.[0]?.path || null;
    const signatureFile = req.files?.signatureFile?.[0]?.path || null;

    // Validation (basic)
    if (!firstName || !lastName || !email || !aadharFile || !signatureFile) {
      return res.status(400).json({ message: 'Missing required fields or files.' });
    }

    const newUser = new UserForm({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      city,
      state,
      pincode,
      aadharNumber,
      aadharFile,
      signatureFile,
      agreeTerms: agreeTerms === 'true',
      agreeMarketing: agreeMarketing === 'true',
    });

    await newUser.save();

    res.status(201).json({ message: 'Form submitted successfully!' });
  } catch (error) {
    console.error('Form submission failed:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};


const getAllRegistrations = async (req, res) => {
  try {
    const registrations = await UserForm.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, registrations }); // ✅ Consistent format
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ success: false, message: 'Error fetching registrations', error });
  }
};

module.exports = {
  submitForm,getAllRegistrations
};
