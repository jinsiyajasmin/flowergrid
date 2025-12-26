import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    avatar: {
      type: String,
    },

    provider: {
      type: String,
      default: 'google',
    },

    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
