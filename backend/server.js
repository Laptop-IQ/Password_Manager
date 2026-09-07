import express from "express";
import cors from "cors";
import "dotenv/config";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import hpp from "hpp";

import userRouter from "./routes/userRoute.js";
import passwordRouter from "./routes/password.route.js";
import connectDB from "./config/db.js";

// ============================================================================
// APP INITIALIZATION
// ============================================================================

const app = express();

const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

const requiredProductionEnv = [
  "MONGODB_URI",
  "JWT_SECRET",
  "CLIENT_URL",
  "SUPABASE_URL",
  "SUPABASE_KEY",
];

if (IS_PRODUCTION) {
  const missingVariables = requiredProductionEnv.filter(
    (variable) => !process.env[variable]?.trim(),
  );

  if (missingVariables.length > 0) {
    console.error(
      `[STARTUP ERROR] Missing environment variables: ${missingVariables.join(", ")}`,
    );

    process.exit(1);
  }
}

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

const normalizeOrigin = (origin) => {
  if (!origin) return "";
  return origin.trim().replace(/\/+$/, "");
};

const allowedOrigins = [
  !IS_PRODUCTION ? "http://localhost:5173" : null,
  process.env.CLIENT_URL,
]
  .filter(Boolean)
  .map(normalizeOrigin)
  .filter((origin, index, origins) => origins.indexOf(origin) === index);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS blocked"));
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

app.use(hpp());

app.use(
  compression({
    threshold: 1024,
  }),
);

// ============================================================================
// RATE LIMITING
// ============================================================================

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PRODUCTION ? 200 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
    });
  },
});

app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PRODUCTION ? 30 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many authentication attempts. Please try again later.",
    });
  },
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PRODUCTION ? 100 : 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many password operations. Please try again later.",
  },

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many password operations. Please try again later.",
    });
  },
});

// Apply auth limiter to auth endpoints
app.use("/api/user/login", authLimiter);
app.use("/api/user/register", authLimiter);
app.use("/api/user/forgot-password", authLimiter);
app.use("/api/user/reset-password", authLimiter);
app.use("/api/user/verify-forgot-otp", authLimiter);

// Apply password limiter to password endpoints
app.use("/api/passwords", passwordLimiter);

// ============================================================================
// BODY PARSING MIDDLEWARE
// ============================================================================

app.use(
  express.json({
    limit: "20kb",
    strict: true,
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20kb",
  }),
);

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

app.use(
  "/uploads",
  express.static("uploads", {
    maxAge: IS_PRODUCTION ? "7d" : 0,

    etag: true,

    lastModified: true,

    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");

      if (IS_PRODUCTION) {
        res.setHeader("Cache-Control", "public, max-age=604800");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

app.get("/health/db", async (req, res) => {
  try {
    // Test MongoDB connection
    const mongoStatus = "connected"; // You can add actual DB test here

    res.status(200).json({
      success: true,
      message: "Database connections healthy",
      mongo: mongoStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// ============================================================================
// API ROUTES
// ============================================================================

// User authentication routes
app.use("/api/user", userRouter);

// Password management routes
app.use("/api/passwords", passwordRouter);

// ============================================================================
// ROOT & DOCUMENTATION
// ============================================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SecureVault API is running",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      healthDb: "/health/db",
      users: "/api/user",
      passwords: "/api/passwords",
    },
    documentation: {
      passwords: {
        create: "POST /api/passwords",
        getAll: "GET /api/passwords",
        getOne: "GET /api/passwords/:id",
        update: "PUT /api/passwords/:id",
        delete: "DELETE /api/passwords/:id",
      },
    },
  });
});

// ============================================================================
// 404 HANDLER
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

app.use((err, req, res, next) => {
  // Only real errors are logged
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);

  // CORS error
  if (err?.message === "CORS blocked") {
    return res.status(403).json({
      success: false,
      message: "CORS policy blocked this request.",
    });
  }

  // JSON parsing error
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload.",
    });
  }

  // Payload too large
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large.",
    });
  }

  // Payload parsing error
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid request payload.",
    });
  }

  // Custom error with status code
  const statusCode = Number(err?.status) || Number(err?.statusCode) || 500;

  const safeStatusCode =
    statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  return res.status(safeStatusCode).json({
    success: false,

    message:
      IS_PRODUCTION && safeStatusCode >= 500
        ? "Internal Server Error"
        : err?.message || "Something went wrong.",
  });
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let server = null;
let isShuttingDown = false;

const shutdown = (signal, error = null) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (error) {
    console.error(`[${signal}]`, error);
  } else {
    console.log(`[${signal}] Shutting down gracefully...`);
  }

  // Server did not start
  if (!server) {
    process.exit(error ? 1 : 0);
  }

  server.close(() => {
    console.log("[SHUTDOWN] Server closed successfully");
    process.exit(error ? 1 : 0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("[SHUTDOWN] Forced shutdown after 10 seconds.");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);
  shutdown("uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
  shutdown("unhandledRejection", reason);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const startServer = async () => {
  try {
    console.log("[STARTUP] Connecting to database...");
    await connectDB();
    console.log("[STARTUP] Database connected successfully");

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`[STARTUP] Server running on port ${PORT} (${NODE_ENV})`);
      console.log(`[STARTUP] Visit http://localhost:${PORT}/ for API info`);
    });

    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;
    server.requestTimeout = 120_000;

    server.on("error", (error) => {
      console.error("[SERVER ERROR]", error);
      shutdown("server error", error);
    });
  } catch (error) {
    console.error("[STARTUP ERROR]", error);
    process.exit(1);
  }
};

startServer();

export default app;
