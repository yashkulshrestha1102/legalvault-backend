const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, htmlContent, attachments = [] }) => {
  if (!process.env.RESEND_API_KEY) {
    console.log('⚠️ RESEND_API_KEY not set — Email fallback mode');
    return { success: true, fallback: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: [to],
      subject: subject,
      html: htmlContent,
      attachments: attachments, // ✅ NAYA: Resend attachment support karta hai
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email sent via Resend. ID:', data?.id);
    return { success: true };
  } catch (err) {
    console.error('❌ Resend send error:', err.message);
    return { success: false, error: err.message };
  }
};

// ═══════════════════════════════════════════
// ✅ 1. Compliance Reminder Email (Professional Redesign + Confirm Button)
// ═══════════════════════════════════════════
const sendComplianceReminderEmail = async ({ 
  to, name, complianceName, companyName, dueDate, daysLeft, period, notes, attachmentUrls = [], complianceId 
}) => {
  console.log(`📧 Sending compliance reminder to: ${to} (with ${attachmentUrls.length} attachments)`);
  
  // Format date to "DD MMM YYYY" (e.g., 29 Oct 2026)
  const formattedDate = new Date(dueDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  // ✅ Frontend URL setup for Confirm Button
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://legalvault-frontend-two.vercel.app';
  const confirmUrl = `${FRONTEND_URL}/confirm-filing/${complianceId}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0; }
        
        /* Header Banner */
        .header-banner { background-color: #eff6ff; padding: 24px; border-bottom: 1px solid #dbeafe; display: flex; align-items: center; }
        .icon-calendar { font-size: 32px; margin-right: 16px; color: #1e3a8a; }
        .header-text h1 { margin: 0; font-size: 22px; color: #1e3a8a; font-weight: 600; }
        .header-text p { margin: 4px 0 0; font-size: 14px; color: #475569; }
        
        /* Body */
        .content { padding: 30px; color: #334155; font-size: 15px; line-height: 1.6; }
        .greeting { margin-top: 0; font-weight: 600; margin-bottom: 16px; }
        
        /* Details Card */
        .details-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 24px 0; }
        .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
        .detail-row:last-child { border-bottom: none; padding-bottom: 0; }
        .detail-row:first-child { padding-top: 0; }
        .detail-icon { width: 30px; color: #3b82f6; font-size: 18px; display: flex; align-items: center; }
        .detail-label { width: 160px; color: #64748b; font-weight: 500; }
        .detail-value { flex: 1; font-weight: 600; color: #0f172a; }
        
        /* Confirm Button */
        .btn-container { text-align: center; margin: 30px 0; }
        .btn-confirm { background-color: #0d9488; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(13, 148, 136, 0.2); transition: background-color 0.3s; }
        .btn-confirm:hover { background-color: #0f766e; }

        /* Footer Callout */
        .footer-callout { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin-top: 24px; display: flex; align-items: flex-start; }
        .check-icon { color: #16a34a; font-size: 20px; margin-right: 12px; margin-top: 2px; }
        .footer-text { font-size: 14px; color: #166534; }
        .footer-text strong { display: block; margin-bottom: 4px; font-size: 15px; color: #14532d; }
      </style>
    </head>
    <body>
      <div class="container">
        
        <!-- Top Banner -->
        <div class="header-banner">
          <div class="icon-calendar">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><circle cx="16" cy="16" r="5" fill="#eff6ff"></circle><path d="M16 13v3l2 2"></path></svg>
          </div>
          <div class="header-text">
            <h1>Compliance Due Date Reminder</h1>
            <p>Please ensure timely filing of your compliance</p>
          </div>
        </div>

        <!-- Email Body -->
        <div class="content">
          <p class="greeting">Dear ${name || 'Team'},</p>
          <p>This is a gentle reminder that the following compliance is due for filing. Please make sure to complete the filing by the due date to avoid any late fees or penalties.</p>
          
          <!-- Details Table -->
          <div class="details-card">
            <div class="detail-row">
              <div class="detail-icon">📄</div>
              <div class="detail-label">Compliance Name</div>
              <div class="detail-value">: &nbsp; ${complianceName}</div>
            </div>
            <div class="detail-row">
              <div class="detail-icon">📅</div>
              <div class="detail-label">Applicable Period</div>
              <div class="detail-value">: &nbsp; ${period || 'N/A'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-icon">🕒</div>
              <div class="detail-label">Due Date</div>
              <div class="detail-value">: &nbsp; ${formattedDate}</div>
            </div>
          </div>

          <!-- ✅ Confirm Filing Button -->
          <div class="btn-container">
            <p style="margin-bottom: 12px; font-weight: bold; color: #334155;">Already completed the filing?</p>
            <a href="${confirmUrl}" class="btn-confirm" target="_blank">Confirm Filing</a>
            <p style="font-size: 12px; color: #64748b; margin-top: 12px;">Click the button above to stop receiving reminders for this compliance.</p>
          </div>

          <!-- Already Filed Note -->
          <div class="footer-callout">
            <div class="check-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#16a34a" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 12l3 3 5-5"></path></svg>
            </div>
            <div class="footer-text">
              <strong>Already filed?</strong>
              If you have already completed the filing, please ignore this reminder.
            </div>
          </div>
          
        </div>
      </div>
    </body>
    </html>
  `;

  // ✅ URL se Buffer banane ka logic (R2/GridFS ke liye)
  let finalAttachments = [];
  try {
    finalAttachments = await Promise.all(
      attachmentUrls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // File ka naam URL se nikalna
        let filename = url.split('/').pop().split('?')[0];
        if (!filename || filename.length > 50) filename = 'Invoice_Attachment';

        return {
          filename: filename,
          content: buffer
        };
      })
    );
  } catch (attachErr) {
    console.error('⚠️ Error fetching attachments for email:', attachErr.message);
  }

  return sendEmail({ 
    to, 
    subject: `⏰ Reminder: ${complianceName} Due on ${formattedDate}`, 
    htmlContent,
    attachments: finalAttachments
  });
};
// ═══════════════════════════════════════════
// ✅ 2. Password Reset Email
// ═══════════════════════════════════════════
const sendPasswordResetEmail = async (email, resetToken) => {
  const resetLink = `https://legalvault.businezexcellence.com/reset-password?token=${resetToken}`;
  const htmlContent = `
    <div style="max-width: 500px; background: white; padding: 30px; border-radius: 10px; margin: 0 auto;">
      <h1 style="color: #0D9488; text-align: center;">LegalVault</h1>
      <h2>Password Reset Request</h2>
      <p>Click the button below to reset your password:</p>
      <div style="text-align: center;">
        <a href="${resetLink}" style="background: #0D9488; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 12px; color: #888;">This link expires in 1 hour.</p>
    </div>
  `;
  return sendEmail({ to: email, subject: '🔑 Password Reset - LegalVault', htmlContent });
};

// ═══════════════════════════════════════════
// ✅ 3. Welcome Email
// ═══════════════════════════════════════════
const sendUserWelcomeEmail = async (email, name, password) => {
  const htmlContent = `
    <div style="max-width: 500px; background: white; padding: 30px; border-radius: 10px; margin: 0 auto;">
      <h1 style="color: #0D9488; text-align: center;">🎉 LegalVault</h1>
      <h2>Welcome ${name || 'User'}!</h2>
      <p>Your account has been created successfully.</p>
      <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
    </div>
  `;
  return sendEmail({ to: email, subject: '🎉 Welcome to LegalVault!', htmlContent });
};

module.exports = {
  sendComplianceReminderEmail,
  sendPasswordResetEmail,
  sendUserWelcomeEmail,
};