
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../db/db.js";

// Cookie configuration
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        success: false,
        message: "Authentication is not configured.",
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Check whether account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is not active.",
      });
    }

    // Verify password against stored hash
    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      }
    );

    // Set HTTP-only authentication cookie
    res.cookie(
      process.env.COOKIE_NAME || "examflow_token",
      token,
      {
        ...getCookieOptions(),
        maxAge: 24 * 60 * 60 * 1000,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error during login.",
    });
  }
};

// LOGOUT
const logout = (req, res) => {
  res.clearCookie(
    process.env.COOKIE_NAME || "examflow_token",
    getCookieOptions()
  );

  return res.status(200).json({
    success: true,
    message: "Logout successful.",
  });
};

// GET CURRENT USER
const getMe = (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

export { login, logout, getMe };
