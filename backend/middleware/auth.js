import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function authMiddleware(req, res, next) {
  // Token grab karo
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Not authorized or token missing",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Token verify karo
    const payload = jwt.verify(token, JWT_SECRET);

    // A pre-auth token (issued before 2FA is completed) must never grant
    // access to protected routes.
    if (payload.pending2FA) {
      return res.status(401).json({
        success: false,
        message: "Two-factor verification required",
      });
    }

    // User fetch karo DB se
    const user = await User.findById(payload.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Tokens issued before session-tracking was added won't carry a "sid" —
    // treat those as expired so every client re-authenticates once.
    if (!payload.sid) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }

    const session = await Session.findById(payload.sid);

    if (!session || session.revoked || String(session.user) !== String(user._id)) {
      return res.status(401).json({
        success: false,
        message: "Session expired or logged out. Please log in again.",
      });
    }

    // Best-effort activity timestamp update — doesn't block the request.
    Session.updateOne({ _id: session._id }, { lastActiveAt: new Date() }).catch(() => {});

    // User & session ko req object me attach karo
    req.user = user;
    req.sessionId = session._id;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({
      success: false,
      message: "Token invalid or expired",
    });
  }
}
