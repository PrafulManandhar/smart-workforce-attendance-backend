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
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
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
    verify(): Promise<boolean>;
  }

  function createTransport(options: TransportOptions): Transporter;

  export { createTransport, Transporter, TransportOptions, SendMailOptions, SentMessageInfo };
}

