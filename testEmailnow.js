require("dotenv").config();

const { sendEmail } = require("./src/services/emailService");

const test = async () => {
  try {
    await sendEmail({
      to: "danielbenevolent1@gmail.com",
      subject: "Trust Signal Trade Test Email",
      html: `
        <h2>Email Test Successful</h2>
        <p>This email was sent from Apex Signal Trade using Gmail SMTP.</p>
      `,
    });

    console.log("Test email sent successfully.");
  } catch (error) {
    console.error("Test email failed:");
    console.error(error);
  }
};

test();