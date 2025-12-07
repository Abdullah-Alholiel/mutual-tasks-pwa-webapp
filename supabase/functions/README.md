# Supabase Edge Functions

This directory contains Supabase Edge Functions for server-side operations.

## Functions

### `auth-magic-link`
Handles magic link authentication:
- `request-login`: Generate and send login magic link
- `request-signup`: Generate and send signup magic link  
- `verify`: Verify magic link token and create session

### `send-email`
Sends emails via MailJet:
- `signup`: Welcome email for new users
- `signin`: Sign-in magic link email
- `task-created`: Task creation notification email

## Deployment

Deploy these functions using the Supabase CLI:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy

# Or deploy individual functions
supabase functions deploy auth-magic-link
supabase functions deploy send-email
```

## Environment Variables

Set these in your Supabase project dashboard (Settings → Edge Functions → Secrets):

- `MailJet_API_Key`: Your MailJet API key
- `MailJet_API_Secret`: Your MailJet API secret
- `MailJet_From_Email`: Sender email address
- `MailJet_From_Name`: Sender name
- `VITE_APP_URL`: Your app URL (for links in emails)

These are automatically available in Edge Functions via `Deno.env.get()`.

## Testing Locally

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve auth-magic-link --env-file .env.local
supabase functions serve send-email --env-file .env.local
```
