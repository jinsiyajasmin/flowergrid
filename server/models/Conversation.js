import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "New conversation",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", ConversationSchema);
