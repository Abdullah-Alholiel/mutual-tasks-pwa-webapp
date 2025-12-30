# Email Sending Fix Summary

## Issues Fixed

### 1. Improved Error Handling in `send-email` Function

**Problem**: Edge Function was returning 500 errors without proper error details.

**Fixes Applied**:
- Added request body parsing with better error handling
- Added validation for empty request bodies
- Improved MailJet API error handling with detailed error messages
- Added try-catch around MailJet fetch call to catch network errors
- Added comprehensive logging for debugging

### 2. Enhanced Error Logging in `auth-magic-link` Function

**Fixes Applied**:
- Improved error extraction from Edge Function invocation errors
- Added better error context logging
- Enhanced error details to help diagnose issues

### 3. Added HTML Escaping for Security

**Fixes Applied**:
- Added `escapeHtml()` function to prevent XSS attacks
- Applied HTML escaping to all user-provided content in email templates
- Safe handling of all dynamic content (user names, task titles, descriptions, etc.)

### 4. Added Validation for Task-Created Emails

**Fixes Applied**:
- Added validation for required fields (task, project, creator, recipient)
- Added default values for optional fields (dueDate)
- Proper error handling if required fields are missing

## Testing

### Quick Test

Run the email test script:

```bash
npm run test:email
```

**Before running**, update `tests/email-test.ts`:
- Replace `test@example.com` with your actual test email address

### Manual Testing

1. **Test via Signup Flow**:
   - Go to `/auth`
   - Fill in signup form with a real email
   - Check your inbox (and spam folder)

2. **Test via Login Flow**:
   - Go to `/auth`
   - Fill in login form with an existing user email
   - Check your inbox (and spam folder)

3. **Test via Manual Activation**:
   - Get token from database: `magic_links` table
   - Use URL: `{APP_URL}/auth/verify?token={TOKEN}`
   - See `MAGIC_LINK_MANUAL_ACTIVATION.md` for details

### Check Logs

1. **Supabase Dashboard**:
   - Go to Edge Functions → `send-email` → Logs
   - Look for:
     - "Email function called" - confirms function was invoked
     - "Request body received" - confirms body was parsed
     - "Email request:" - shows email details
     - "Sending email via MailJet:" - confirms MailJet call
     - "Email sent successfully" or error messages

2. **MailJet Dashboard**:
   - Check "Activity" section
   - Look for sent emails
   - Check for bounces or blocks

## Common Issues & Solutions

### Issue: "Email service not configured"

**Solution**: Set MailJet credentials in Supabase:
1. Go to Supabase Dashboard
2. Settings → Edge Functions → Secrets
3. Add these secrets:
   - `MailJet_API_Key` - Your MailJet API key
   - `MailJet_API_Secret` - Your MailJet API secret
   - `MailJet_From_Email` - Verified sender email in MailJet
   - `MailJet_From_Name` - Display name (e.g., "Momentum")
   - `VITE_APP_URL` - Your app URL (for magic links)

### Issue: "MailJet API error: 401"

**Solution**: 
- Invalid API credentials
- Double-check `MailJet_API_Key` and `MailJet_API_Secret` in Supabase secrets
- Verify credentials in MailJet dashboard

### Issue: "MailJet API error: 400"

**Solution**:
- Invalid email format
- Missing required fields
- Check MailJet API response in logs for specific error

### Issue: Emails not arriving

**Check**:
1. **MailJet Status**: Check if MailJet is operational
2. **Sender Email Verification**: Verify sender email in MailJet dashboard
3. **Spam Folder**: Check spam/junk folder
4. **Email Limits**: Check MailJet account limits (free tier has limits)
5. **Email Blocks**: Check MailJet dashboard for blocked emails

### Issue: Edge Function returns 500

**Check Logs**:
1. Open Supabase Dashboard → Edge Functions → `send-email` → Logs
2. Look for the most recent error
3. Common causes:
   - Missing MailJet credentials
   - Invalid request body format
   - MailJet API error
   - Network issues

## Deployment

After making changes, redeploy the Edge Functions:

```bash
# Deploy send-email function
supabase functions deploy send-email

# Deploy auth-magic-link function
supabase functions deploy auth-magic-link

# Or deploy both
supabase functions deploy
```

## Next Steps

1. **Test email sending** using `npm run test:email`
2. **Check Supabase logs** after testing
3. **Verify MailJet credentials** are set correctly
4. **Test signup/login flow** with real email addresses
5. **Monitor MailJet dashboard** for delivery status

## Files Modified

- `supabase/functions/send-email/index.ts` - Enhanced error handling and validation
- `supabase/functions/auth-magic-link/index.ts` - Improved error logging
- `tests/email-test.ts` - New test script
- `tests/README.md` - Test documentation
- `package.json` - Added `test:email` script

## Additional Resources

- `MAGIC_LINK_MANUAL_ACTIVATION.md` - Manual activation guide
- `MAGIC_LINK_SETUP.md` - Full setup guide
- MailJet API Docs: https://dev.mailjet.com/email/guides/send-api-v31/
