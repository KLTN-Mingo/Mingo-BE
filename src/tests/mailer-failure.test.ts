function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testSendMailThrowsWhenConfiguredTransportFails() {
  const nodemailer = require("nodemailer");
  const originalCreateTransport = nodemailer.createTransport;
  const originalEnv = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_SECURE: process.env.SMTP_SECURE,
    MAIL_FROM: process.env.MAIL_FROM,
  };

  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "user";
  process.env.SMTP_PASS = "pass";
  process.env.SMTP_SECURE = "false";
  process.env.MAIL_FROM = "Mingo <no-reply@example.com>";

  nodemailer.createTransport = () => ({
    sendMail: async () => {
      throw new Error("smtp failed");
    },
  });

  const mailerPath = require.resolve("../lib/mailer");
  delete require.cache[mailerPath];
  const { sendMail } = require("../lib/mailer");

  let threw = false;
  try {
    await sendMail({
      to: "test@example.com",
      subject: "Test",
      text: "Body",
    });
  } catch (error) {
    threw = true;
    assert(
      error instanceof Error && error.message === "smtp failed",
      "Expected original SMTP failure to be surfaced"
    );
  } finally {
    nodemailer.createTransport = originalCreateTransport;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    delete require.cache[mailerPath];
  }

  assert(threw, "Expected sendMail to throw when configured SMTP send fails");
}

testSendMailThrowsWhenConfiguredTransportFails()
  .then(() => console.log("mailer failure test passed"))
  .catch((err) => {
    console.error("mailer failure test failed:", err);
    process.exit(1);
  });
