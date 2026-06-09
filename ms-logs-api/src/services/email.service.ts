import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || '',
    },
});

interface AlertEmailData {
    ruleName: string;
    severity: string;
    title: string;
    message: string;
    queryResult: number;
    dataSource: string;
    conditionOperator: string;
    conditionValue: number;
    checkedAt: string;
}

function buildHtml(data: AlertEmailData): string {
    const severityColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
        CRITICAL: { bg: '#991b1b', text: '#fca5a5', border: '#dc2626', label: 'CRITICA' },
        WARNING: { bg: '#92400e', text: '#fcd34d', border: '#f59e0b', label: 'ADVERTENCIA' },
        INFO: { bg: '#1e3a5f', text: '#93c5fd', border: '#3b82f6', label: 'INFORMATIVA' },
    };

    const sev = severityColors[data.severity] ?? severityColors['INFO']!;

    const operatorLabels: Record<string, string> = {
        eq: '=', neq: '!=', gt: '>', lt: '<', gte: '>=', lte: '<=',
    };

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,${sev.bg},#1e293b);padding:28px 32px;border-bottom:2px solid ${sev.border};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="display:inline-block;padding:4px 12px;border-radius:6px;background-color:${sev.border};color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;">${sev.label}</span>
                  <h1 style="margin:12px 0 0;color:#f1f5f9;font-size:22px;font-weight:700;line-height:1.3;">${data.title}</h1>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="padding:24px 32px;">
            <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 20px;">${data.message}</p>

            <!-- Result card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:20px;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%" style="padding:8px 0;">
                        <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Resultado de la query</p>
                        <p style="color:${sev.text};font-size:28px;font-weight:700;margin:0;font-family:monospace;">${data.queryResult}</p>
                      </td>
                      <td width="50%" style="padding:8px 0;">
                        <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Condicion</p>
                        <p style="color:#e2e8f0;font-size:16px;margin:0;">resultado <span style="color:${sev.text};font-weight:600;">${operatorLabels[data.conditionOperator] || data.conditionOperator}</span> ${data.conditionValue}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:8px;border:1px solid #334155;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #334155;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Regla</td>
                      <td align="right" style="color:#e2e8f0;font-size:13px;">${data.ruleName}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #334155;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Fuente de datos</td>
                      <td align="right" style="color:#e2e8f0;font-size:13px;">${data.dataSource}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Evaluado</td>
                      <td align="right" style="color:#e2e8f0;font-size:13px;">${data.checkedAt}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155;background-color:#0f172a;">
            <p style="color:#475569;font-size:12px;margin:0;text-align:center;">
              Tajo Backoffice &middot; Sistema de alertas automaticas
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export class EmailService {
    static async sendAlertEmail(to: string[], data: AlertEmailData): Promise<void> {
        const smtpUser = process.env.SMTP_USER;
        if (!smtpUser || to.length === 0) return;

        const html = buildHtml(data);
        const severityPrefix = data.severity === 'CRITICAL' ? '🔴' : data.severity === 'WARNING' ? '🟡' : 'ℹ️';

        await transporter.sendMail({
            from: `"Tajo Alertas" <${smtpUser}>`,
            to: to.join(', '),
            subject: `${severityPrefix} ${data.title}`,
            html,
        });
    }
}
