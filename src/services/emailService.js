const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is missing");
  }

  if (!to || !subject || !html) {
    throw new Error(
      "Email requires a recipient, subject, and HTML content"
    );
  }

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (error) {
    console.error("Resend API error:", error);
    throw new Error(error.message || "Resend failed to send email");
  }

  console.log("Resend accepted email:", {
    id: data.id,
    to: Array.isArray(to) ? to : [to],
    subject,
  });

  return data;
};

module.exports = {
  sendEmail,
};