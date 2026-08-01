const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const {
  ROLES,
  USER_STATUS,
  LAWYER_VERIFICATION
} = require("../constants");

const lawyerProfileSchema = new mongoose.Schema(
  {
    licenseNumber: { type: String, trim: true, maxlength: 100 },
    specialization: { type: String, trim: true, maxlength: 100, index: true },
    bio: { type: String, trim: true, maxlength: 3000 },
    experienceYears: { type: Number, min: 0, max: 80, default: 0 },
    hourlyRate: { type: Number, min: 0, max: 10000000, default: 0 },
    verificationStatus: {
      type: String,
      enum: Object.values(LAWYER_VERIFICATION),
      default: LAWYER_VERIFICATION.PENDING,
      index: true
    },
    verificationNote: { type: String, trim: true, maxlength: 500 }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CLIENT,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true
    },
    emailVerified: { type: Boolean, default: false, index: true },
    phone: { type: String, trim: true, maxlength: 30 },
    city: { type: String, trim: true, maxlength: 100, index: true },
    avatarUrl: { type: String, trim: true, maxlength: 1000 },
    authProvider: {
      type: String,
      enum: ["local", "firebase"],
      default: "local"
    },
    firebaseUid: { type: String, sparse: true, unique: true },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
    lawyerProfile: lawyerProfileSchema
  },
  { timestamps: true, optimisticConcurrency: true }
);

userSchema.pre("save", async function hashPassword(next) {
  try {
    if (!this.isModified("passwordHash") || !this.passwordHash) return next();
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.verifyPassword = function verifyPassword(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const value = this.toObject();
  delete value.passwordHash;
  delete value.tokenVersion;
  delete value.firebaseUid;
  return value;
};

userSchema.set("toJSON", {
  transform: (_document, value) => {
    delete value.passwordHash;
    delete value.tokenVersion;
    delete value.firebaseUid;
    return value;
  }
});

userSchema.index({
  role: 1,
  status: 1,
  emailVerified: 1,
  "lawyerProfile.verificationStatus": 1
});

module.exports = mongoose.model("User", userSchema);
