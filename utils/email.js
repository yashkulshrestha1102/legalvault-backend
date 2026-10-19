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
// ✅ 1. Compliance Reminder Email
// ═══════════════════════════════════════════
const sendComplianceReminderEmail = async ({ 
  to, name, complianceName, companyName, dueDate, daysLeft, period, notes, attachmentUrl 
}) => {
  console.log('📧 Sending compliance reminder to:', to);
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 500px; background: white; padding: 30px; border-radius: 10px; margin: 0 auto;">
        <h1 style="color: #0D9488; text-align: center;">LegalVault</h1>
        <h2>⏰ Compliance Reminder</h2>
        <p>Hi ${name || 'Team'},</p>
        
        <!-- ✅ Company Name Add kiya -->
        <p><strong>Company:</strong> ${companyName || 'N/A'}</p>
        
        <p><strong>${complianceName}</strong> ki due date <strong>${new Date(dueDate).toLocaleDateString('en-IN')}</strong> hai.</p>
        <p style="color: #e11d48; font-size: 18px;">Sirf <strong>${daysLeft} din</strong> bache hain!</p>
        ${period ? `<p><strong>Period:</strong> ${period}</p>` : ''}
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        
        ${attachmentUrl ? `<p><strong>📄 Attachment:</strong> <a href="${attachmentUrl}">Click here to view</a></p>` : ''}
        
        <p style="color: #e11d48;">Please time par file kar dijiye taaki penalty na lage.</p>
      </div>
    </body>
    </html>
  `;

  // ✅ Attachment handle karna
  const attachments = attachmentUrl ? [{ path: attachmentUrl }] : [];

  return sendEmail({ 
    to, 
    subject: `⏰ Reminder: ${complianceName} for ${companyName || 'Company'} due in ${daysLeft} day(s)`, 
    htmlContent,
    attachments 
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