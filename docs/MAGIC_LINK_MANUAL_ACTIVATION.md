# Magic Link Manual Activation Guide

## URL Format

To manually activate a magic link, use the following URL format:

```
{APP_URL}/auth/verify?token={TOKEN}
```

### URL Components

- **`{APP_URL}`**: Your application's base URL. This is determined by:
  - Environment variable `VITE_APP_URL` (if set in Supabase Edge Function secrets)
  - Default fallback: `http://localhost:8080` (for local development)

- **`{TOKEN}`**: The magic link token stored in the database `magic_links` table

### Examples

#### Local Development
```
http://localhost:8080/auth/verify?token=abc123def456...
```

#### Production
If `VITE_APP_URL` is set to `https://yourdomain.com`:
```
https://yourdomain.com/auth/verify?token=abc123def456...
```

## Finding the Token in the Database

1. **Access your Supabase dashboard**
2. **Navigate to**: Table Editor → `magic_links` table
3. **Find the record** for the user (filter by `email` or `user_id`)
4. **Copy the `token` value** from the `token` column
5. **Construct the URL** using the format above

## Token Status

- **Valid tokens**: Have `used_at` set to `NULL` and `expires_at` in the future
- **Used tokens**: Have `used_at` set to a timestamp
- **Expired tokens**: Have `expires_at` in the past

## Important Notes

- Magic links expire after **15 minutes**
- Each token can only be used **once**
- After successful verification, the token is marked as used (`used_at` is set)
- The URL must use the exact token value from the database (it's a long hexadecimal string)

## Troubleshooting

### Token Not Working

1. Check if token is expired (`expires_at < now()`)
2. Check if token was already used (`used_at IS NOT NULL`)
3. Verify the token matches exactly (no extra spaces or characters)
4. Ensure `VITE_APP_URL` is correctly set in Supabase Edge Function secrets

### Email Not Received

If the magic link notification shows as "sent successfully" but the email isn't received:

1. **Check Supabase Edge Function logs** for `send-email` function:
   - Go to Supabase Dashboard → Edge Functions → `send-email` → Logs
   - Look for MailJet API errors

2. **Verify MailJet credentials** are set in Supabase Edge Function secrets:
   - `MailJet_API_Key`
   - `MailJet_API_Secret`
   - `MailJet_From_Email`
   - `MailJet_From_Name`

3. **Check MailJet account**:
   - Verify your MailJet account is active
   - Check MailJet dashboard for sent emails and any bounces/blocks
   - Verify the sender email address is verified in MailJet

4. **Check spam/junk folders** - emails might be filtered

5. **Use manual activation** as a workaround using the URL format above

