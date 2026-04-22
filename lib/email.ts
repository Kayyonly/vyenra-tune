type SendOtpEmailInput = {
  email: string;
  code: string;
};

type SendOtpEmailResult = {
  success: boolean;
  message: string;
};

const DEFAULT_FROM = 'Vynra Tune <no-reply@domainkamu.com>';

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
        text: `Kode verifikasi kamu adalah: ${code}\nKode ini berlaku selama 15 menit.`,
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
            'Resend masih mode testing: verifikasi domain di https://resend.com/domains, lengkapi DNS SPF + DKIM, lalu gunakan sender seperti Vynra Tune <no-reply@domainkamu.com>.',
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