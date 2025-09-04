import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface StaffInvitationEmailParams {
  to: string;
  firstName: string;
  lastName: string;
  operationName: string;
  invitedBy: string;
  invitationToken: string;
}

export async function sendStaffInvitationEmail(params: StaffInvitationEmailParams): Promise<boolean> {
  const { to, firstName, lastName, operationName, invitedBy, invitationToken } = params;
  
  // Create invitation link (in production this would be your domain)
  const invitationLink = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/accept-invitation?token=${invitationToken}`;
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CattleNutrition Pro - Team Invitation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">CattleNutrition Pro</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Team Invitation</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333; margin-top: 0;">You're Invited to Join ${operationName}!</h2>
        
        <p>Hi ${firstName},</p>
        
        <p>${invitedBy} has invited you to join their cattle operation team on CattleNutrition Pro. As a staff member, you'll be able to:</p>
        
        <ul style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <li style="margin-bottom: 8px;">📊 View operation dashboard and statistics</li>
          <li style="margin-bottom: 8px;">🐄 Record cattle feeding activities</li>
          <li style="margin-bottom: 8px;">⚖️ Update pen weights and cattle data</li>
          <li style="margin-bottom: 8px;">📝 Record death loss and treatment records</li>
          <li style="margin-bottom: 8px;">👥 View all pen and cattle information</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationLink}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            Accept Invitation
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          This invitation will expire in 7 days. If you have any questions, please contact ${invitedBy} directly.
        </p>
      </div>
    </body>
    </html>
  `;

  const emailText = `
You're Invited to Join ${operationName}!

Hi ${firstName},

${invitedBy} has invited you to join their cattle operation team on CattleNutrition Pro. 

As a staff member, you'll be able to:
• View operation dashboard and statistics
• Record cattle feeding activities  
• Update pen weights and cattle data
• Record death loss and treatment records
• View all pen and cattle information

To accept this invitation, please visit:
${invitationLink}

This invitation will expire in 7 days. If you have any questions, please contact ${invitedBy} directly.

Best regards,
CattleNutrition Pro Team
  `;

  try {
    await mailService.send({
      to,
      from: 'noreply@cattlenutrition.pro', // Replace with your verified SendGrid sender
      subject: `Team Invitation: Join ${operationName} on CattleNutrition Pro`,
      text: emailText.trim(),
      html: emailHtml,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}