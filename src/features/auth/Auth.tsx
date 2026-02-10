import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Sparkles, Mail, ArrowRight, AtSign, CheckCircle2, Copy, Check } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { validateHandleFormat } from '@/lib/userUtils';
import { requestLogin, requestSignup, verifyMagicLink } from '@/lib/auth/auth';
import { setSessionToken } from '@/lib/auth/sessionStorage';
import { PageLoader } from '@/components/ui/loader';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link2 } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AuthLogo } from './AuthLogo';
import { getDatabaseClient } from '@/db';

const FloatingBlobs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <motion.div
      animate={{
        x: [0, 100, 0],
        y: [0, -50, 0],
        scale: [1, 1.2, 1],
        rotate: [0, 10, 0]
      }}
      transition={{
        duration: 25,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-primary/20 blur-[130px] rounded-full"
    />
    <motion.div
      animate={{
        x: [0, -80, 0],
        y: [0, 100, 0],
        scale: [1, 1.1, 1],
        rotate: [0, -15, 0]
      }}
      transition={{
        duration: 30,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="absolute top-[10%] -right-[15%] w-[50%] h-[50%] bg-accent/15 blur-[130px] rounded-full"
    />
    <motion.div
      animate={{
        x: [0, 50, 0],
        y: [0, 80, 0],
        scale: [1, 1.3, 1],
        rotate: [0, 5, 0]
      }}
      transition={{
        duration: 22,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="absolute -bottom-[20%] left-[5%] w-[65%] h-[65%] bg-primary/10 blur-[130px] rounded-full"
    />
  </div>
);

const AuthHeader = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, y: -30 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{
      type: "spring",
      stiffness: 100,
      damping: 20
    }}
    className="text-center mb-6 relative z-10"
  >
    <AuthLogo />
    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 gradient-text">
      Momentum
    </h1>
    <p className="text-base md:text-lg text-muted-foreground font-medium max-w-[280px] mx-auto leading-tight">
      Accomplish more, together.
    </p>
  </motion.div>
);

const SuccessScreen = ({
  handleContinueInBrowser,
  handleCopyLink,
  linkCopied,
  isIOS,
  isAndroid,
  isMobile
}: any) => (
  <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 md:p-6 py-6 md:py-10 relative">
    <FloatingBlobs />
    <div className="w-full max-w-md relative z-10">
      <AuthHeader />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 md:p-8 shadow-2xl border-border/50 glass-strong rounded-[2rem]">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.3 }}
                className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
              >
                <CheckCircle2 className="w-8 h-8 text-success" />
              </motion.div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2 tracking-tight">You're in!</h2>
              <p className="text-muted-foreground text-sm">
                Your account is ready. Choose how you'd like to continue.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleContinueInBrowser}
                className="w-full gradient-primary text-white hover:opacity-95 shadow-lg shadow-primary/25 rounded-xl h-12 text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Continue to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              {(isIOS || isAndroid) && (
                <div className="space-y-4 pt-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background/20 backdrop-blur-md px-4 text-muted-foreground font-semibold">
                        Home Screen PWA
                      </span>
                    </div>
                  </div>

                  <div className="bg-muted/30 border border-border/40 backdrop-blur-md rounded-2xl p-5 text-left space-y-4">
                    <p className="text-sm font-medium text-muted-foreground text-center">
                      To sign in to your installed app:
                    </p>
                    <div className="flex justify-center">
                      <Button
                        onClick={handleCopyLink}
                        variant="secondary"
                        className="w-full rounded-xl h-11"
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
                  </div>
                </div>
              )}

              {!isMobile && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    onClick={handleCopyLink}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:bg-muted/50 rounded-lg"
                  >
                    {linkCopied ? (
                      <><Check className="w-3 h-3 mr-1" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3 mr-1" /> Copy Link</>
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
);

const Auth = () => {
  const [loginMethod, setLoginMethod] = useState<'username' | 'email'>('username');
  const [loginInput, setLoginInput] = useState('');
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
            const sessionToken = result.sessionToken || localStorage.getItem('momentum_session_token');
            const expiresAt = result.expiresAt || localStorage.getItem('momentum_session_expiry');
            if (sessionToken) {
              setHandoffToken(sessionToken);
              setHandoffExpiresAt(expiresAt);
              await refresh();
              setVerificationComplete(true);
              setIsVerifying(false);
            } else {
              toast.error("We couldn't find your session. Please try signing in again.");
              setIsVerifying(false);
              navigate('/auth');
            }
          } else {
            toast.error(result.error || "Verification didn't work. Let's try one more time.");
            setIsVerifying(false);
            navigate('/auth');
          }
        } catch (error) {
          console.error('Verification error:', error);
          toast.error("Something went wrong with the link. Please try again.");
          setIsVerifying(false);
          navigate('/auth');
        }
      };
      verify();
    }
  }, [searchParams, navigate, refresh]);

  const getAppUrl = (): string => window.location.origin;
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = typeof window !== 'undefined' && /Android/.test(navigator.userAgent);

  const getHandoffUrl = (): string => {
    if (!handoffToken) return '';
    const appUrl = getAppUrl();
    let handoffUrl = `${appUrl}/?handoff_token=${encodeURIComponent(handoffToken)}`;
    if (handoffExpiresAt) handoffUrl += `&expires_at=${encodeURIComponent(handoffExpiresAt)}`;
    return handoffUrl;
  };

  const handleContinueInBrowser = () => navigate('/');

  const handleCopyLink = async () => {
    const handoffUrl = getHandoffUrl();
    if (handoffUrl && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(handoffUrl);
        setLinkCopied(true);
        toast.success('Link copied! Paste it in the app to continue. 📋');
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        toast.error("We couldn't copy the link. Try again?");
      }
    }
  };

  const handlePasteLink = async () => {
    if (!pastedLink.trim()) {
      toast.error('Paste your sign-in link here first.');
      return;
    }
    setIsPasteLinkLoading(true);
    try {
      const trimmedLink = pastedLink.trim();
      let url: URL;
      try {
        url = new URL(trimmedLink);
      } catch {
        if (trimmedLink.startsWith('/')) url = new URL(trimmedLink, window.location.origin);
        else if (trimmedLink.includes('?')) url = new URL(trimmedLink, window.location.origin);
        else if (trimmedLink.includes('token=')) url = new URL(`/auth/verify?${trimmedLink.split('?')[1]}`, window.location.origin);
        else throw new Error('Invalid URL format');
      }

      const hToken = url.searchParams.get('handoff_token');
      const expiresAt = url.searchParams.get('expires_at');
      if (hToken) {
        const expiry = expiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
        setSessionToken(hToken, expiry);
        await refresh();
        toast.success("You're in! Welcome back. 👋");
        navigate('/');
        return;
      }

      const mToken = url.searchParams.get('token');
      if (mToken) {
        const result = await verifyMagicLink(mToken);
        if (result.success && result.sessionToken) {
          await refresh();
          toast.success("You're in! Let's get started. 🚀");
          navigate('/');
        } else {
          toast.error(result.error || "That link doesn't seem to work.");
        }
        return;
      }
      toast.error('Invalid sign-in link.');
    } catch (err) {
      toast.error('Failed to process link.');
    } finally {
      setIsPasteLinkLoading(false);
    }
  };

  if (authLoading && !isVerifying && !searchParams.get('token')) {
    return <PageLoader text="Resuming context..." />;
  }

  if (isVerifying) {
    return <PageLoader text="Verifying magic link..." />;
  }

  if (verificationComplete) {
    return (
      <SuccessScreen
        handleContinueInBrowser={handleContinueInBrowser}
        handleCopyLink={handleCopyLink}
        linkCopied={linkCopied}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isMobile={isMobile}
      />
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    let emailToSend = loginInput.trim();

    if (!emailToSend) {
      toast.error(`Please enter your ${loginMethod}`);
      return;
    }

    setIsLoading(true);
    try {
      if (loginMethod === 'username') {
        // Just try to find the user
        const db = getDatabaseClient();
        const user = await db.users.getByHandle(loginInput);

        if (!user) {
          toast.error('User not found', {
            description: "We couldn't find an account with that username."
          });
          setIsLoading(false);
          return;
        }
        emailToSend = user.email;
      } else {
        // Email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToSend)) {
          toast.error('Please enter a valid email address');
          setIsLoading(false);
          return;
        }
      }

      const result = await requestLogin(emailToSend);
      if (result.success) {
        toast.success("Magic link sent! Check your inbox. 💌", {
          description: `We've sent it to ${loginMethod === 'username' ? emailToSend : emailToSend}.`,
          duration: 8000,
        });
        setLoginInput('');
      } else {
        toast.error(result.error || "We couldn't send the magic link. Let's try again.");
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
    const handleValidation = validateHandleFormat(signupHandle);
    if (!handleValidation.isValid) {
      toast.error(handleValidation.error || 'Invalid handle format');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestSignup(signupEmail.trim(), signupName.trim(), signupHandle.trim());
      if (result.success) {
        toast.success("Welcome aboard! Check your email to join. 🌊", {
          description: `We've sent a magic link to ${signupEmail}. If you don't see it, try the spam folder.`,
          duration: 8000,
        });
        setSignupEmail('');
        setSignupName('');
        setSignupHandle('');
      } else {
        toast.error(result.error || "We couldn't send the magic link. Try again?");
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-x-hidden relative selection:bg-primary/20">
      <FloatingBlobs />

      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle size="compact" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center p-4 md:p-6 py-6 md:py-12">
        <div className="w-full max-w-[400px]">
          <AuthHeader />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 100, damping: 20 }}
          >
            <Card className="p-6 md:p-8 shadow-2xl border-border/40 glass-strong rounded-[2rem]">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-muted/30 p-1 rounded-xl border border-border/20">
                  <TabsTrigger value="login" className="text-sm font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-sm font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login" className="space-y-6 mt-0 focus-visible:outline-none">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight">Welcome back</h2>
                    <p className="text-sm text-muted-foreground font-medium">
                      Pick up where you left off.
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-input" className="font-bold text-xs ml-1">
                          {loginMethod === 'username' ? 'Username' : 'Email Address'}
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginMethod(prev => prev === 'username' ? 'email' : 'username');
                            setLoginInput('');
                          }}
                          className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                        >
                          Use {loginMethod === 'username' ? 'Email' : 'Username'} instead
                        </button>
                      </div>
                      <div className="relative group">
                        {loginMethod === 'username' ? (
                          <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        ) : (
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        )}
                        <Input
                          id="login-input"
                          type={loginMethod === 'username' ? 'text' : 'email'}
                          placeholder={loginMethod === 'username' ? 'username' : 'you@email.com'}
                          value={loginInput}
                          onChange={(e) => setLoginInput(e.target.value)}
                          className="pl-11 h-12 text-sm rounded-xl border-border/60 bg-white/50 dark:bg-black/20 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full gradient-primary text-white hover:opacity-95 shadow-lg shadow-primary/25 rounded-xl h-12 text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Magic Link
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-xs font-medium text-muted-foreground space-y-2 backdrop-blur-sm">
                    <p className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <span>
                        No passwords, no friction. We'll email you a secure link to jump right in.
                      </span>
                    </p>
                    <p className="flex items-start gap-2 text-amber-600/90 dark:text-amber-500/90">
                      <Mail className="w-4 h-4 shrink-0" />
                      <span>
                        Don't see it? Peek in your spam folder—sometimes magic links get lost.
                      </span>
                    </p>
                  </div>

                  <div className="pt-1">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/50" />
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase">
                        <span className="bg-transparent px-3 text-muted-foreground font-bold">
                          Alternative
                        </span>
                      </div>
                    </div>

                    {!showPasteLink ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full mt-4 text-muted-foreground font-semibold h-10 text-xs rounded-lg hover:bg-muted/50 transition-colors"
                        onClick={() => setShowPasteLink(true)}
                      >
                        <Link2 className="w-3 h-3 mr-2" />
                        Sign In with Link
                      </Button>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <Input
                          type="url"
                          placeholder="Paste the full link from your email here..."
                          value={pastedLink}
                          onChange={(e) => setPastedLink(e.target.value)}
                          className="h-10 text-xs font-mono rounded-lg border-border bg-white/30 dark:bg-black/10"
                          disabled={isPasteLinkLoading}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-10 text-xs rounded-lg"
                            onClick={() => { setShowPasteLink(false); setPastedLink(''); }}
                            disabled={isPasteLinkLoading}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="flex-1 gradient-primary text-white h-10 text-xs rounded-lg font-bold"
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
                <TabsContent value="signup" className="space-y-6 mt-0 focus-visible:outline-none">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight">Join Momentum</h2>
                    <p className="text-sm text-muted-foreground font-medium">
                      Start collaborating today.
                    </p>
                  </div>

                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="font-bold text-xs ml-1">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Your Name"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        className="h-12 text-sm rounded-xl border-border/60 bg-white/50 dark:bg-black/20 focus:ring-primary/20 transition-all shadow-sm"
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="font-bold text-xs ml-1">Email Address</Label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@email.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="pl-11 h-12 text-sm rounded-xl border-border/60 bg-white/50 dark:bg-black/20"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-handle" className="font-bold text-xs ml-1">Handle</Label>
                      <div className="relative group">
                        <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="signup-handle"
                          type="text"
                          placeholder="username"
                          value={signupHandle}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (val && !val.startsWith('@')) val = `@${val}`;
                            setSignupHandle(val);
                          }}
                          className="pl-11 h-12 text-sm rounded-xl border-border/60 bg-white/50 dark:bg-black/20"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium ml-1">
                        Unique handle for identification.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full gradient-primary text-white hover:opacity-95 shadow-lg shadow-primary/25 rounded-xl h-12 text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create Account
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-xs font-medium text-muted-foreground space-y-2 backdrop-blur-sm">
                    <p className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <span>
                        We'll send you a link to verify your email and complete your setup.
                      </span>
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center text-xs text-muted-foreground/70 mt-8 font-medium px-4"
            >
              By continuing, you agree to our <span className="underline underline-offset-2 hover:text-foreground cursor-pointer transition-colors">Terms of Service</span> and <span className="underline underline-offset-2 hover:text-foreground cursor-pointer transition-colors">Privacy Policy</span>
            </motion.p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
