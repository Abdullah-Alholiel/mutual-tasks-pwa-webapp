import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Sparkles, Mail, ArrowRight, AtSign, CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { validateHandleFormat } from '@/lib/userUtils';
import { requestLogin, requestSignup, verifyMagicLink } from '@/lib/auth/auth';
import { setSessionToken } from '@/lib/auth/sessionStorage';
import { PageLoader } from '@/components/ui/loader';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link2 } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';

const Auth = () => {
  const [loginEmail, setLoginEmail] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupHandle, setSignupHandle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [handoffToken, setHandoffToken] = useState<string | null>(null);
  const [handoffExpiresAt, setHandoffExpiresAt] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showPasteLink, setShowPasteLink] = useState(false);
  const [pastedLink, setPastedLink] = useState('');
  const [isPasteLinkLoading, setIsPasteLinkLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { isAuthenticated, loading: authLoading, refresh } = useAuth();

  // Redirect authenticated users to home (but not during magic link verification)
  useEffect(() => {
    // Don't redirect if we're in the middle of magic link verification flow
    if (!authLoading && isAuthenticated && !isVerifying && !verificationComplete && !searchParams.get('token')) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, authLoading, isVerifying, verificationComplete, searchParams, navigate]);

  // Handle magic link verification
  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      const verify = async () => {
        setIsVerifying(true);
        try {
          const result = await verifyMagicLink(token);

          if (result.success) {
            // Get token - prefer result value, fallback to localStorage
            const sessionToken = result.sessionToken || localStorage.getItem('momentum_session_token');
            const expiresAt = result.expiresAt || localStorage.getItem('momentum_session_expiry');

            if (sessionToken) {
              // Always show handoff screen - user can choose how to continue
              // This ensures consistent experience on mobile browsers
              setHandoffToken(sessionToken);
              setHandoffExpiresAt(expiresAt);

              // Refresh auth state to fetch user data immediately
              // This ensures when they click "Continue", they are already authenticated
              await refresh();

              setVerificationComplete(true);
              setIsVerifying(false);
            } else {
              // No token found - show error
              toast.error('Session token not found. Please try signing in again.');
              setIsVerifying(false);
              navigate('/auth');
            }
          } else {
            toast.error(result.error || 'Magic link verification failed. Please try again.');
            setIsVerifying(false);
            navigate('/auth');
          }
        } catch (error) {
          console.error('Verification error:', error);
          toast.error('Magic link verification failed. Please try again.');
          setIsVerifying(false);
          navigate('/auth');
        }
      };

      verify();
    }
  }, [searchParams, navigate, refresh]);

  // Get app URL for handoff link
  const getAppUrl = (): string => {
    // In production, use the production URL
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.origin;
    }
    // For localhost, detect the production URL or use current origin
    return window.location.origin;
  };

  // Detect iOS
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Detect Android
  const isAndroid = typeof window !== 'undefined' && /Android/.test(navigator.userAgent);

  // Get handoff URL
  const getHandoffUrl = (): string => {
    if (!handoffToken) return '';
    const appUrl = getAppUrl();
    let handoffUrl = `${appUrl}/?handoff_token=${encodeURIComponent(handoffToken)}`;
    if (handoffExpiresAt) {
      handoffUrl += `&expires_at=${encodeURIComponent(handoffExpiresAt)}`;
    }
    return handoffUrl;
  };

  // Handle "Continue to App" button click
  const handleContinueToApp = () => {
    const handoffUrl = getHandoffUrl();
    if (handoffUrl) {
      // On mobile, this will try to open the PWA if installed
      window.location.href = handoffUrl;
    } else {
      navigate('/');
    }
  };

  // Handle "Continue in Browser" button
  const handleContinueInBrowser = () => {
    navigate('/');
  };

  // Copy handoff link to clipboard
  const handleCopyLink = async () => {
    const handoffUrl = getHandoffUrl();
    if (handoffUrl && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(handoffUrl);
        setLinkCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        toast.error('Failed to copy link');
      }
    }
  };

  // Handle pasted sign-in link (for PWA users)
  // Supports both magic link tokens (?token=xxx) and handoff tokens (?handoff_token=xxx)
  const handlePasteLink = async () => {
    if (!pastedLink.trim()) {
      toast.error('Please paste a sign-in link');
      return;
    }

    setIsPasteLinkLoading(true);

    try {
      const trimmedLink = pastedLink.trim();

      // Parse the URL - handle both relative and absolute URLs
      let url: URL;
      try {
        // Try parsing as absolute URL first
        url = new URL(trimmedLink);
      } catch {
        // If it's a relative URL or path, try to construct full URL
        if (trimmedLink.startsWith('/')) {
          url = new URL(trimmedLink, window.location.origin);
        } else if (trimmedLink.includes('?')) {
          // Try to parse as relative URL with query params
          url = new URL(trimmedLink, window.location.origin);
        } else if (trimmedLink.includes('token=')) {
          // Just query params, construct full URL
          url = new URL(`/auth/verify?${trimmedLink.split('?')[1]}`, window.location.origin);
        } else {
          throw new Error('Invalid URL format - please paste the complete link');
        }
      }

      console.log('Parsed URL:', url.href);
      console.log('Search params:', Object.fromEntries(url.searchParams.entries()));

      // Check for handoff_token first (from handoff flow)
      const handoffToken = url.searchParams.get('handoff_token');
      const expiresAt = url.searchParams.get('expires_at');

      if (handoffToken) {
        // This is a handoff token - use it directly
        const expiry = expiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
        setSessionToken(handoffToken, expiry);
        // Refresh auth state to fetch user data
        await refresh();
        toast.success('Successfully signed in!');
        navigate('/');
        return;
      }

      // Check for magic link token (?token=xxx)
      const magicLinkToken = url.searchParams.get('token');

      if (magicLinkToken) {
        console.log('Found magic link token, verifying...');
        // This is a magic link - verify it and create session
        const result = await verifyMagicLink(magicLinkToken);

        if (result.success && result.sessionToken) {
          // Refresh auth state to fetch user data
          await refresh();
          toast.success('Successfully signed in!');
          navigate('/');
        } else {
          console.error('Magic link verification failed:', result.error);
          toast.error(result.error || 'Invalid or expired magic link. Please request a new one.');
        }
        return;
      }

      // No valid token found - provide helpful error
      console.error('No token found in URL. Search params:', url.searchParams.toString());
      toast.error('Invalid sign-in link. The link must contain a "token" parameter. Please copy the complete link from your email (it should include "?token=").');
    } catch (err) {
      console.error('Failed to process link:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes('Invalid URL') || err instanceof TypeError) {
        toast.error('Invalid link format. Please paste the complete URL from your email, starting with "https://"');
      } else {
        toast.error(`Failed to process link: ${errorMessage}. Please make sure you copied the complete link from your email.`);
      }
    } finally {
      setIsPasteLinkLoading(false);
    }
  };

  // Show loading while checking authentication (but not during magic link verification)
  if (authLoading && !isVerifying && !searchParams.get('token')) {
    return <PageLoader text="Checking authentication..." />;
  }

  // Show full page loader during magic link verification
  if (isVerifying) {
    return <PageLoader text="Verifying magic link..." />;
  }

  // Show "Continue to App" success screen
  if (verificationComplete) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
        <div className="flex flex-col items-center justify-center p-4 md:p-6 py-8 md:py-12">
          <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden">
              <img
                src="/icons/icon-192x192.png"
                alt="Momentum"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">Momentum</h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 md:p-8 shadow-lg border-border/50">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold mb-2">You're signed in!</h2>
                  <p className="text-muted-foreground text-sm md:text-base">
                    Your account is ready. Choose how you'd like to continue.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Primary: Continue in current context */}
                  <Button
                    onClick={handleContinueInBrowser}
                    className="w-full gradient-primary text-white hover:opacity-90"
                    size="lg"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  {/* For PWA users on mobile */}
                  {(isIOS || isAndroid) && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            Have the app installed?
                          </span>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
                        <p className="text-sm text-muted-foreground">
                          To sign in to the home screen app:
                        </p>
                        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                          <li>Copy the sign-in link below</li>
                          <li>Open Momentum from your home screen</li>
                          <li>Tap "Sign In with Link" and paste</li>
                        </ol>

                        <Button
                          onClick={handleCopyLink}
                          variant="secondary"
                          className="w-full"
                          size="sm"
                        >
                          {linkCopied ? (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Link Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy Sign-In Link
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}

                  {/* Desktop: Show copy link option */}
                  {!isMobile && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button
                        onClick={handleCopyLink}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                      >
                        {linkCopied ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy Sign-In Link
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const result = await requestLogin(loginEmail.trim());

      if (result.success) {
        toast.success('Magic link sent! ✨', {
          description: `Check your email at ${loginEmail} for the sign-in link. Please also check your spam/junk folder if you don't see it.`,
          duration: 8000, // Show longer so user can read
        });
        setLoginEmail(''); // Clear form
      } else {
        toast.error(result.error || 'Failed to send magic link');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupEmail.trim() || !signupName.trim() || !signupHandle.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate handle format
    const handleValidation = validateHandleFormat(signupHandle);
    if (!handleValidation.isValid) {
      toast.error(handleValidation.error || 'Invalid handle format');
      return;
    }

    setIsLoading(true);

    try {
      const result = await requestSignup(signupEmail.trim(), signupName.trim(), signupHandle.trim());

      if (result.success) {
        toast.success('Magic link sent! ✨', {
          description: `Check your email at ${signupEmail} to complete your registration. Please also check your spam/junk folder if you don't see it.`,
          duration: 8000, // Show longer so user can read
        });
        // Clear form
        setSignupEmail('');
        setSignupName('');
        setSignupHandle('');
      } else {
        toast.error(result.error || 'Failed to send magic link');
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
      <div className="flex flex-col items-center justify-center p-4 md:p-6 py-8 md:py-12">
        <div className="w-full max-w-md">
        {/* Logo/Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden">
            <img
              src="/icons/icon-192x192.png"
              alt="Momentum"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">Momentum</h1>
          <p className="text-muted-foreground">Collaborative Tasks</p>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 md:p-8 shadow-lg border-border/50">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="text-sm md:text-base">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-sm md:text-base">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-6 mt-0">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
                  <p className="text-muted-foreground text-sm md:text-base">
                    Enter your email to receive a magic link
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10 text-base"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full gradient-primary text-white hover:opacity-90"
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Sending magic link...
                      </>
                    ) : (
                      <>
                        Send Magic Link
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                  <p className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      We'll send you a secure link to sign in. No password needed!
                    </span>
                  </p>
                  <p className="flex items-start gap-2 text-amber-600 dark:text-amber-500">
                    <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="font-medium">
                      Important: Please check your spam/junk folder if you don't see the email in your inbox!
                    </span>
                  </p>
                </div>

                {/* Sign In with Link option (for PWA users) */}
                <div className="pt-2">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>

                  {!showPasteLink ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full mt-4 text-muted-foreground"
                      onClick={() => setShowPasteLink(true)}
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Sign In with Link
                    </Button>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs text-muted-foreground text-center">
                        Paste the sign-in link from your email (the full URL)
                      </p>
                      <Input
                        type="url"
                        placeholder="https://mutualtask-pwa.netlify.app/auth/verify?token=..."
                        value={pastedLink}
                        onChange={(e) => setPastedLink(e.target.value)}
                        className="text-sm font-mono"
                        disabled={isPasteLinkLoading}
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        Paste the complete link including "https://" and "?token="
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setShowPasteLink(false);
                            setPastedLink('');
                          }}
                          disabled={isPasteLinkLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="flex-1 gradient-primary text-white"
                          onClick={handlePasteLink}
                          disabled={isPasteLinkLoading || !pastedLink.trim()}
                        >
                          {isPasteLinkLoading ? 'Signing in...' : 'Sign In'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup" className="space-y-6 mt-0">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Create account</h2>
                  <p className="text-muted-foreground text-sm md:text-base">
                    Get started with Momentum in seconds
                  </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="text-base"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10 text-base"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-handle">Handle</Label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="signup-handle"
                        type="text"
                        placeholder="@yourhandle"
                        value={signupHandle}
                        onChange={(e) => {
                          let value = e.target.value;
                          // Auto-add @ if user types without it
                          if (value && !value.startsWith('@')) {
                            value = `@${value}`;
                          }
                          setSignupHandle(value);
                        }}
                        className="pl-10 text-base"
                        disabled={isLoading}
                        required
                        pattern="^@[a-zA-Z0-9_]+$"
                        minLength={3}
                        maxLength={30}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your unique identifier. Letters, numbers, and underscores only.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full gradient-primary text-white hover:opacity-90"
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                  <p className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      We'll send you a magic link to verify your email and complete registration.
                    </span>
                  </p>
                  <p className="flex items-start gap-2 text-amber-600 dark:text-amber-500">
                    <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="font-medium">
                      Important: Please check your spam/junk folder if you don't see the email in your inbox!
                    </span>
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            By continuing, you agree to our Terms of Service and Privacy Policy
          </motion.p>
        </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

