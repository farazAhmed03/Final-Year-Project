const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const {
  ROLES,
  USER_STATUS,
  LAWYER_VERIFICATION
} = require("../constants");

/*
 * API responses mein sirf yeh fields expose ho sakti hain.
 *
 * Blacklist ke bajaye whitelist use ki gayi hai, taake future mein
 * model mein koi naya sensitive field add ho to woh automatically
 * API response mein leak na ho.
 */
const PUBLIC_USER_FIELDS = Object.freeze([
  "_id",
  "name",
  "email",
  "role",
  "status",
  "emailVerified",
  "phone",
  "city",
  "avatarUrl",
  "authProvider",
  "lastLoginAt",
  "lawyerProfile",
  "createdAt",
  "updatedAt"
]);

/**
 * Mongoose document ko safe public user object mein convert karta hai.
 *
 * Intentionally excluded:
 * - passwordHash
 * - tokenVersion
 * - firebaseUid
 * - __v
 */
function toPublicUser(_document, value) {
  const safeUser = {};

  for (const field of PUBLIC_USER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      safeUser[field] = value[field];
    }
  }

  return safeUser;
}

const lawyerProfileSchema = new mongoose.Schema(
  {
    licenseNumber: {
      type: String,
      trim: true,
      maxlength: 100
    },

    specialization: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 3000
    },

    experienceYears: {
      type: Number,
      min: 0,
      max: 80,
      default: 0
    },

    hourlyRate: {
      type: Number,
      min: 0,
      max: 10000000,
      default: 0
    },

    verificationStatus: {
      type: String,
      enum: Object.values(LAWYER_VERIFICATION),
      default: LAWYER_VERIFICATION.PENDING,
      index: true
    },

    verificationNote: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  {
    _id: false
  }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    /*
     * Password hash default queries mein load nahi hoga.
     * Login/change-password mein explicitly:
     *
     * .select("+passwordHash")
     *
     * use kiya jata hai.
     */
    passwordHash: {
      type: String,
      select: false
    },

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

    emailVerified: {
      type: Boolean,
      default: false,
      index: true
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true
    },

    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    authProvider: {
      type: String,
      enum: ["local", "firebase"],
      default: "local"
    },

    /*
     * Internal provider identifier.
     * Public API serializer is field ko expose nahi karta.
     */
    firebaseUid: {
      type: String,
      sparse: true,
      unique: true
    },

    /*
     * Password change, suspension ya forced logout ke baad
     * existing JWT sessions invalidate karne ke liye.
     *
     * Yeh API response mein expose nahi hota.
     */
    tokenVersion: {
      type: Number,
      default: 0
    },

    lastLoginAt: Date,

    lawyerProfile: lawyerProfileSchema
  },
  {
    timestamps: true,
    optimisticConcurrency: true,

    /*
     * Direct res.json(user) hone par bhi sensitive fields
     * automatically remove ho jayengi.
     */
    toJSON: {
      virtuals: false,
      versionKey: false,
      transform: toPublicUser
    },

    /*
     * user.toObject() ko bhi safe banata hai.
     */
    toObject: {
      virtuals: false,
      versionKey: false,
      transform: toPublicUser
    }
  }
);

/*
 * New ya changed password ko bcrypt se hash karta hai.
 * Async middleware ko callback ke saath mix nahi kiya gaya.
 */
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("passwordHash") || !this.passwordHash) {
    return;
  }

  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

/**
 * Plain-text password ko stored bcrypt hash se compare karta hai.
 */
userSchema.methods.verifyPassword = function verifyPassword(password) {
  if (!this.passwordHash) {
    return false;
  }

  return bcrypt.compare(password, this.passwordHash);
};

/**
 * Authentication controllers ke liye explicit safe serializer.
 */
userSchema.methods.toSafeObject = function toSafeObject() {
  return this.toObject();
};

/*
 * Lawyer directory aur admin filtering ke common query fields.
 */
userSchema.index({
  role: 1,
  status: 1,
  emailVerified: 1,
  "lawyerProfile.verificationStatus": 1
});

module.exports = mongoose.model("User", userSchema);