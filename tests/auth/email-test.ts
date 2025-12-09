// ============================================================================
// Email Sending Test Script
// ============================================================================
// This script tests the email sending functionality
// Run with: tsx tests/email-test.ts
// ============================================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testEmailSending() {
  console.log('🧪 Testing Email Sending...\n');

  // Test 1: Signup email
  console.log('Test 1: Signup email');
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'signup',
        to: 'nada.abdelhadyy1601@gmail.com', // Replace with your test email
        magicLink: 'https://localhost:8080/auth/verify?token=test-token-123',
        userName: 'Test User',
      },
    });

    if (error) {
      console.error('❌ Error:', error);
      console.error('   Message:', error.message);
      if (error.context) {
        console.error('   Context:', error.context);
      }
    } else {
      console.log('✅ Success:', data);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Signin email
  console.log('Test 2: Signin email');
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'signin',
        to: 'nada.abdelhadyy1601@gmail.com', // Replace with your test email
        magicLink: 'https://localhost:8080/auth/verify?token=test-token-456',
        userName: 'Test User',
      },
    });

    if (error) {
      console.error('❌ Error:', error);
      console.error('   Message:', error.message);
      if (error.context) {
        console.error('   Context:', error.context);
      }
    } else {
      console.log('✅ Success:', data);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Check Edge Function logs
  console.log('📋 Next steps:');
  console.log('   1. Check Supabase Dashboard → Edge Functions → send-email → Logs');
  console.log('   2. Check your email inbox (and spam folder)');
  console.log('   3. Verify MailJet credentials are set in Supabase secrets:');
  console.log('      - MailJet_API_Key');
  console.log('      - MailJet_API_Secret');
  console.log('      - MailJet_From_Email');
  console.log('      - MailJet_From_Name');
}

// Run the tests
testEmailSending()
  .then(() => {
    console.log('\n✅ Tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
