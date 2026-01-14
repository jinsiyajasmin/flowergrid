import mongoose from "mongoose";

const ChatSummarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sessionId: {
      type: String,
      required: true,
    },

    name: String,
    email: String,
    avatar: String,

    summary: String,
    title: String,

    messages: [
      {
        role: String,
        content: String,
      },
    ],
  },
  { timestamps: true }
);

ChatSummarySchema.index(
  { userId: 1, sessionId: 1 },
  { unique: true }
);

export default mongoose.model("ChatSummary", ChatSummarySchema);
