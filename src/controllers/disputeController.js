import Dispute from "../models/Dispute.js";
import { logActivity } from "../utils/activityLogger.js";

export const createDispute = async (req, res) => {
  try {
    const { title, description, againstUser } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "title and description are required" });
    }

    const dispute = await Dispute.create({
      title,
      description,
      againstUser: againstUser || null,
      raisedBy: req.user.id,
    });

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "dispute.create",
      targetType: "dispute",
      targetId: dispute._id,
    });

    res.status(201).json(dispute);
  } catch (error) {
    res.status(500).json({ message: "Failed to create dispute" });
  }
};

export const getMyDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find({ raisedBy: req.user.id })
      .populate("againstUser", "name email role")
      .sort({ createdAt: -1 });

    res.json(disputes);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch disputes" });
  }
};
