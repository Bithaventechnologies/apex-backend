const nodemailer = require("nodemailer");

const getTransporter = () => {
  const requiredEnv = [
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_USER",
    "EMAIL_PASSWORD",
    "EMAIL_FROM",
  ];

  const missing = requiredEnv.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing email environment variables: ${missing.join(", ")}`
    );
  }

  const port = Number(process.env.EMAIL_PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("EMAIL_PORT must be a valid port number");
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject || !html) {
    throw new Error(
      "Email requires a recipient, subject, and HTML content"
    );
  }

  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });

    console.log("Email accepted by SMTP server:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    if (
      Array.isArray(info.accepted) &&
      info.accepted.length === 0
    ) {
      throw new Error("SMTP server did not accept the recipient");
    }

    return info;
  } catch (error) {
    console.error("Email sending failed:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });

    throw error;
  }
};

module.exports = {
  sendEmail,
};