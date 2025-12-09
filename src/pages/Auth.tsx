import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Sparkles, Mail, ArrowRight, Zap, AtSign } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { validateHandleFormat } from '@/lib/userUtils';
import { requestLogin, requestSignup, verifyMagicLink } from '@/lib/auth';
import { PageLoader } from '@/components/ui/loader';

const Auth = () => {
  const [loginEmail, setLoginEmail] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupHandle, setSignupHandle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle magic link verification
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      setIsVerifying(true);
      verifyMagicLink(token)
        .then((result) => {
          if (result.success) {
            toast.success('Welcome! You are now signed in.');
            navigate('/');
          } else {
            toast.error(result.error || 'Magic link verification failed. Please try again.');
            navigate('/auth');
          }
        })
        .catch((error) => {
          console.error('Verification error:', error);
          toast.error('Magic link verification failed. Please try again.');
          navigate('/auth');
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, [searchParams, navigate]);

  // Show full page loader during magic link verification
  if (isVerifying) {
    return <PageLoader text="Verifying magic link..." />;
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
          description: `Check your email at ${loginEmail} for the sign-in link`
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
          description: `Check your email at ${signupEmail} to complete your registration`
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mb-4">
            <Zap className="w-8 h-8 text-white" />
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

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      We'll send you a secure link to sign in. No password needed!
                    </span>
                  </p>
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

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      We'll send you a magic link to verify your email and complete registration.
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
  );
};

export default Auth;

