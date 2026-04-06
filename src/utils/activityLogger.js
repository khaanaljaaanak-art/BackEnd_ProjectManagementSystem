import ActivityLog from "../models/ActivityLog.js";

export const logActivity = async ({
  actor,
  actorRole,
  action,
  targetType,
  targetId,
  meta,
}) => {
  try {
    await ActivityLog.create({
      actor: actor || null,
      actorRole: actorRole || "system",
      action,
      targetType: targetType || "system",
      targetId: targetId || null,
      meta: meta || {},
    });
  } catch (_error) {
    // Avoid blocking core flows when logging fails.
  }
};
