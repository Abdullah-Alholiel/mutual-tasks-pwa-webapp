# Manual Supabase Configuration Guide

This guide covers all manual configuration steps needed in the Supabase Dashboard to make email sending work.

## Step 1: Configure Edge Function Secrets

**Location**: Supabase Dashboard → Settings → Edge Functions → Secrets

Click **"New secret"** for each of the following:

### Required Secrets

1. **MailJet_API_Key**
   - **Name**: `MailJet_API_Key` (exact case)
   - **Value**: Your MailJet API key
   - **How to find**: 
     - Go to MailJet Dashboard → Account Settings → API Keys
     - Copy the **API Key** (not the Secret Key)

2. **MailJet_API_Secret**
   - **Name**: `MailJet_API_Secret` (exact case)
   - **Value**: Your MailJet secret key
   - **How to find**:
     - Go to MailJet Dashboard → Account Settings → API Keys
     - Copy the **Secret Key**

3. **MailJet_From_Email**
   - **Name**: `MailJet_From_Email` (exact case)
   - **Value**: Your verified sender email address
   - **Important**: Must be verified in MailJet
   - **How to verify**:
     - Go to MailJet Dashboard → Senders → Add Sender
     - Enter your email and verify it via the confirmation email

4. **MailJet_From_Name**
   - **Name**: `MailJet_From_Name` (exact case)
   - **Value**: Display name for emails (e.g., "Momentum" or "Your App Name")

5. **APP_URL** or **VITE_APP_URL** (optional - auto-detected if not set)
   - **Name**: `APP_URL` or `VITE_APP_URL` (exact case)
   - **Value**: Your application's base URL
   - **Examples**:
     - Development: `http://localhost:8080`
     - Production: `https://social-momentum.netlify.app`
   - **Important**: No trailing slash at the end
   - **Auto-detection**: If not set, the Edge Function will automatically detect the environment:
     - **Production**: Uses `https://social-momentum.netlify.app` when Supabase URL contains `.supabase.co`
     - **Development**: Uses `http://localhost:8080` for local development

### Secret Name Case Sensitivity

⚠️ **Warning**: Secret names are case-sensitive. They must match exactly:
- ✅ `MailJet_API_Key` (correct)
- ❌ `MAILJET_API_KEY` (wrong)
- ❌ `mailjet_api_key` (wrong)
- ❌ `MailJet_Api_Key` (wrong)

## Step 2: Verify Edge Functions are Deployed

**Location**: Supabase Dashboard → Edge Functions

Verify both functions appear in the list:
- ✅ `auth-magic-link` - Should show as "Deployed"
- ✅ `send-email` - Should show as "Deployed"

If not deployed, run these commands locally:
```bash
supabase functions deploy auth-magic-link
supabase functions deploy send-email
```

## Step 3: Test Edge Function Directly

**Location**: Supabase Dashboard → Edge Functions → `send-email` → Invoke

1. Click on the **"Invoke"** tab
2. Use this test payload:
```json
{
  "type": "signup",
  "to": "your-actual-email@example.com",
  "magicLink": "https://yourdomain.com/auth/verify?token=test-token-123",
  "userName": "Test User"
}
```
3. Click **"Invoke function"**
4. Check the response:
   - ✅ Success: Should show `{"success": true}`
   - ❌ Error: Will show error message

## Step 4: Check Edge Function Logs

**Location**: Supabase Dashboard → Edge Functions → `send-email` → Logs

After invoking the function or running tests, check logs for:

### Success Indicators:
- "Email function called"
- "Request body received"
- "Sending email via MailJet"
- "Email sent successfully via MailJet"

### Error Indicators:
- "MailJet credentials not configured" → Missing secrets
- "MailJet API error: 401" → Invalid credentials
- "MailJet API error: 400" → Invalid request format
- Any JavaScript errors or stack traces

## Step 5: Verify MailJet Account Setup

### In MailJet Dashboard:

1. **Verify Sender Email**:
   - Go to MailJet Dashboard → Senders
   - Ensure your sender email is verified
   - Status should show as "Active" or "Verified"

2. **Check API Credentials**:
   - Go to MailJet Dashboard → Account Settings → API Keys
   - Verify API Key and Secret Key match what you put in Supabase secrets

3. **Check Email Limits**:
   - Free tier has daily limits
   - Check if you've exceeded limits: MailJet Dashboard → Account → Usage

4. **Check Email Activity**:
   - Go to MailJet Dashboard → Activity
   - Look for sent emails
   - Check for bounces, blocks, or delivery issues

## Troubleshooting

### Issue: "Email service not configured"
**Solution**: Add `MailJet_API_Key` and `MailJet_API_Secret` secrets in Supabase

### Issue: "MailJet API error: 401"
**Solution**: 
- Double-check API Key and Secret in MailJet dashboard
- Ensure they match exactly what's in Supabase secrets
- Check for extra spaces or characters

### Issue: "MailJet API error: 400"
**Solution**:
- Check sender email is verified in MailJet
- Verify email format is correct
- Check MailJet API response in logs for specific error

### Issue: Emails not arriving
**Check**:
1. Spam/junk folder
2. MailJet Activity dashboard for delivery status
3. MailJet account limits
4. Sender email verification status

### Issue: Edge Function returns 500
**Steps**:
1. Check Supabase logs (Edge Functions → send-email → Logs)
2. Look for the actual error message
3. Most common: Missing MailJet secrets
4. Verify all secrets are set correctly

## Quick Checklist

- [ ] MailJet_API_Key secret added in Supabase
- [ ] MailJet_API_Secret secret added in Supabase
- [ ] MailJet_From_Email secret added in Supabase
- [ ] MailJet_From_Name secret added in Supabase
- [ ] APP_URL or VITE_APP_URL secret added in Supabase (optional - auto-detected if not set)
- [ ] Sender email verified in MailJet dashboard
- [ ] Edge functions deployed (`auth-magic-link` and `send-email`)
- [ ] Tested function via Supabase Dashboard → Invoke
- [ ] Checked logs for errors

## After Configuration

1. Run the test script: `npm run test:email`
2. Check Supabase logs for detailed error messages
3. Check your email inbox (and spam folder)
4. If still not working, check MailJet Activity dashboard
