import nodemailer, { type Transporter } from "nodemailer";
import { env, isTest } from "../config/env.js";
import { logger } from "./logger.js";

let transporter: Transporter | null = null;

function getTransporter() {
  if (!env.SMTP_HOST || isTest) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Sends one email. Returns false (and logs) when SMTP isn't configured or sending fails. */
export async function sendMail(to: string, subject: string, text: string) {
  const transport = getTransporter();
  if (!transport) {
    logger.warn({ to, subject }, "SMTP not configured; email not sent");
    return false;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
    return true;
  } catch (err) {
    logger.error({ err, subject }, "Failed to send email");
    return false;
  }
}

/**
 * Emails the team about a new submission. Never throws: a mail failure must not
 * lose the submission, which is already saved in MongoDB.
 */
export async function notifyTeam(subject: string, fields: Record<string, string | undefined>) {
  const transport = getTransporter();
  if (!transport || !env.NOTIFY_EMAIL) return;

  const rows = Object.entries(fields)
    .filter(([, value]) => value)
    .map(
      ([key, value]) =>
        `<tr><th align="left">${escapeHtml(key)}</th><td>${escapeHtml(value!)}</td></tr>`,
    )
    .join("");
  const text = Object.entries(fields)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: env.NOTIFY_EMAIL,
      replyTo: fields.Email,
      subject,
      text,
      html: `<table cellpadding="6">${rows}</table>`,
    });
  } catch (err) {
    logger.error({ err, subject }, "Failed to send notification email");
  }
}
