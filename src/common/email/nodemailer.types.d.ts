// Minimal typings shim for nodemailer to avoid adding @types dependency.
declare module 'nodemailer' {
  interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    tls?: {
      rejectUnauthorized?: boolean;
      [key: string]: any;
    };
  }

  interface SendMailOptions {
    from?: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }

  interface SentMessageInfo {
    messageId: string;
    [key: string]: any;
  }

  interface Transporter {
    sendMail(mailOptions: SendMailOptions): Promise<SentMessageInfo>;
  }

  function createTransport(options: TransportOptions): Transporter;

  export { createTransport, Transporter, TransportOptions, SendMailOptions, SentMessageInfo };
}

