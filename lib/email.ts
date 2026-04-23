type SendOtpEmailInput = {
  email: string;
  code: string;
};

type SendOtpEmailResult = {
  success: boolean;
  message: string;
};

const DEFAULT_FROM = 'Vynra Tune <no-reply@kayy.my.id>';

function getOtpEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 48px 0;">
    <tr>
      <td align="center">
        <table width="440" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius: 4px;">
          <tr>
            <td style="background:#18181b; padding: 20px 36px;">
              <span style="color:#ffffff; font-size: 15px; font-weight: bold; letter-spacing: 0.5px;">vynra tune</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 36px 32px;">
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 15px; line-height: 1.7;">Hai,</p>
              <p style="margin: 0 0 32px; color: #3f3f46; font-size: 15px; line-height: 1.7;">
                Berikut kode verifikasi untuk masuk ke akun Vynra Tune kamu:
              </p>
              <div style="border-left: 3px solid #18181b; padding: 16px 24px; margin-bottom: 32px; background: #fafafa;">
                <p style="margin: 0 0 4px; color: #a1a1aa; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; font-family: sans-serif;">Kode verifikasi</p>
                <p style="margin: 0; color: #18181b; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</p>
              </div>
              <p style="margin: 0 0 8px; color: #71717a; font-size: 13px; line-height: 1.7; font-family: sans-serif;">
                Kode berlaku selama 10 menit.
              </p>
              <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.7; font-family: sans-serif;">
                Kalau kamu tidak merasa request ini, abaikan saja email ini.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 36px 32px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; font-family: sans-serif;">
                © 2025 Vynra Tune &nbsp;·&nbsp; <a href="https://kayy.my.id" style="color: #a1a1aa;">kayy.my.id</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail({ email, code }: SendOtpEmailInput): Promise<SendOtpEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  if (!apiKey) {
    console.error('[OTP_EMAIL_CONFIG_ERROR] Missing RESEND_API_KEY in environment variables.');
    return {
      success: false,
      message: 'Konfigurasi email belum lengkap. Pastikan RESEND_API_KEY tersedia di .env.local.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: 'Kode Verifikasi Vynra Tune',
        html: getOtpEmailHtml(code),
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      const isTestingEmailLimit = responseBody.includes('You can only send testing emails');

      console.error('[OTP_EMAIL_SEND_ERROR]', response.status, responseBody);

      if (isTestingEmailLimit) {
        return {
          success: false,
          message:
            'Resend masih mode testing: verifikasi domain di https://resend.com/domains, lengkapi DNS SPF + DKIM, lalu gunakan sender seperti Vynra Tune <no-reply@kayy.my.id>.',
        };
      }

      return {
        success: false,
        message: 'Gagal kirim OTP',
      };
    }

    return {
      success: true,
      message: 'OTP berhasil dikirim',
    };
  } catch (error) {
    console.error('[OTP_EMAIL_FETCH_ERROR]', error);
    return {
      success: false,
      message: 'Gagal kirim OTP',
    };
  }
}
