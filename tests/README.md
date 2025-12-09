# Email Testing Guide

This directory contains test scripts for email functionality.

## Setup

1. **Set environment variables** in your `.env` file:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Update test email address** in `email-test.ts`:
   - Replace `test@example.com` with your actual test email address

## Running Email Tests

```bash
# Install dependencies if needed
npm install

# Run the email test
tsx tests/email-test.ts
```

## What the test does

1. **Test 1: Signup Email** - Tests sending a signup magic link email
2. **Test 2: Signin Email** - Tests sending a signin magic link email

## Troubleshooting

### Email not sending

1. **Check Supabase Edge Function logs**:
   - Go to Supabase Dashboard → Edge Functions → `send-email` → Logs
   - Look for errors or warnings

2. **Verify MailJet credentials** in Supabase:
   - Go to Settings → Edge Functions → Secrets
   - Verify these are set:
     - `MailJet_API_Key`
     - `MailJet_API_Secret`
     - `MailJet_From_Email`
     - `MailJet_From_Name`

3. **Check MailJet account**:
   - Verify your MailJet account is active
   - Check MailJet dashboard for sent emails
   - Verify sender email is verified in MailJet
   - Check for bounces or blocks

4. **Check email service status**:
   - Visit MailJet status page
   - Check if there are any service disruptions

### Common Errors

#### "Email service not configured"
- **Solution**: Set MailJet credentials in Supabase Edge Function secrets

#### "MailJet API error: 401"
- **Solution**: Invalid API key or secret. Double-check credentials.

#### "MailJet API error: 400"
- **Solution**: Invalid email format or missing required fields

#### "Edge Function returned a non-2xx status code"
- **Solution**: Check Edge Function logs for detailed error message

## Manual Testing

You can also test email sending manually by:

1. **Using the Supabase Dashboard**:
   - Go to Edge Functions → `send-email` → Invoke
   - Use this payload:
   ```json
   {
     "type": "signup",
     "to": "your-email@example.com",
     "magicLink": "https://yourdomain.com/auth/verify?token=test-token",
     "userName": "Test User"
   }
   ```

2. **Testing via auth flow**:
   - Sign up with a real email address
   - Check your inbox for the magic link
   - Use the manual activation URL if email doesn't arrive

## Email Templates

The email templates are defined in:
- `supabase/functions/send-email/index.ts`

Templates available:
- `signup` - Welcome email with signup magic link
- `signin` - Sign-in email with magic link
- `task-created` - Notification when a task is created
