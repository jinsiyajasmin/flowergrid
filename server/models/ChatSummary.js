import mongoose from 'mongoose';

const chatSummarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    summary: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('ChatSummary', chatSummarySchema);
