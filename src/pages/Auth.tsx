import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Train, AlertCircle, Loader2, Activity, Shield, Zap, BarChart3, Mail, Lock, User } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const features = [
  {
    icon: Activity,
    title: 'Real-Time Monitoring',
    description: 'Track all trains across your section with live updates',
  },
  {
    icon: Zap,
    title: 'AI-Powered Decisions',
    description: 'Get intelligent recommendations for optimal train precedence',
  },
  {
    icon: Shield,
    title: 'Safety First',
    description: 'Conflict detection and prevention with automated alerts',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Monitor throughput, delays, and utilization metrics',
  },
];

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.' 
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Welcome back',
        description: 'Successfully logged in.',
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = signupSchema.safeParse({
      fullName: signupFullName,
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupFullName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Account Exists',
          description: 'This email is already registered. Please log in instead.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Signup Failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Account Created',
        description: 'Welcome to Railway Traffic Control.',
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-railway-dark flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-railway-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-railway-dark flex">
      {/* Left Panel - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-railway-blue/20 via-railway-dark to-railway-cyan/10" />
        <div className="absolute inset-0 grid-pattern opacity-20" />
        
        {/* Animated track lines */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-px bg-gradient-to-r from-transparent via-railway-blue/50 to-transparent"
              style={{ top: `${20 + i * 15}%`, left: 0, right: 0 }}
              animate={{
                opacity: [0.2, 0.8, 0.2],
                scaleX: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 3,
                delay: i * 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        {/* Moving train indicator */}
        <motion.div
          className="absolute w-4 h-4 bg-railway-cyan rounded-full shadow-lg shadow-railway-cyan/50"
          style={{ top: '35%' }}
          animate={{
            x: ['-10%', '110%'],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Logo */}
            <div className="flex items-center gap-4 mb-8">
              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-railway-blue/20 flex items-center justify-center border border-railway-blue/30 backdrop-blur-sm">
                  <Train className="w-7 h-7 text-railway-blue" />
                </div>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Section Control <span className="text-railway-blue">AI</span>
                </h1>
                <p className="text-sm text-railway-gray">Indian Railways</p>
              </div>
            </div>

            {/* Tagline */}
            <h2 className="text-4xl xl:text-5xl font-bold text-white mb-4 leading-tight">
              Intelligent Traffic
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-railway-blue to-railway-cyan">
                Control System
              </span>
            </h2>
            <p className="text-lg text-railway-gray mb-12 max-w-md">
              AI-powered decision support for section controllers. Maximize throughput, minimize delays.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="p-4 rounded-lg bg-railway-darker/50 border border-railway-gray/20 backdrop-blur-sm hover:border-railway-blue/30 transition-colors"
                >
                  <feature.icon className="w-5 h-5 text-railway-blue mb-2" />
                  <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-railway-gray">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Stats at bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-8 left-12 xl:left-20 right-12 flex items-center gap-8"
        >
          <div>
            <p className="text-3xl font-bold text-white font-mono">98.5%</p>
            <p className="text-xs text-railway-gray">On-Time Performance</p>
          </div>
          <div className="w-px h-10 bg-railway-gray/30" />
          <div>
            <p className="text-3xl font-bold text-white font-mono">-45%</p>
            <p className="text-xs text-railway-gray">Delay Reduction</p>
          </div>
          <div className="w-px h-10 bg-railway-gray/30" />
          <div>
            <p className="text-3xl font-bold text-white font-mono">24/7</p>
            <p className="text-xs text-railway-gray">AI Monitoring</p>
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-lg bg-railway-blue/20 flex items-center justify-center border border-railway-blue/30">
              <Train className="w-5 h-5 text-railway-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                Section Control <span className="text-railway-blue">AI</span>
              </h1>
            </div>
          </div>

          <div className="bg-railway-darker/80 border border-railway-gray/20 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-railway-gray">Sign in to access your control panel</p>
            </div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-railway-dark/50 p-1 rounded-lg mb-6">
                <TabsTrigger 
                  value="login"
                  className="rounded-md data-[state=active]:bg-railway-blue data-[state=active]:text-white transition-all"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="rounded-md data-[state=active]:bg-railway-blue data-[state=active]:text-white transition-all"
                >
                  Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-railway-light text-sm">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-railway-gray/50" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="controller@railways.gov.in"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10 bg-railway-dark/50 border-railway-gray/30 text-white placeholder:text-railway-gray/40 focus:border-railway-blue focus:ring-railway-blue/20 h-12 rounded-lg"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-railway-light text-sm">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-railway-gray/50" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10 bg-railway-dark/50 border-railway-gray/30 text-white placeholder:text-railway-gray/40 focus:border-railway-blue focus:ring-railway-blue/20 h-12 rounded-lg"
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-railway-blue to-railway-cyan hover:opacity-90 text-white font-semibold rounded-lg transition-all shadow-lg shadow-railway-blue/25"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-railway-light text-sm">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-railway-gray/50" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Rajesh Kumar"
                        value={signupFullName}
                        onChange={(e) => setSignupFullName(e.target.value)}
                        className="pl-10 bg-railway-dark/50 border-railway-gray/30 text-white placeholder:text-railway-gray/40 focus:border-railway-blue h-11 rounded-lg"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.fullName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-railway-light text-sm">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-railway-gray/50" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="controller@railways.gov.in"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10 bg-railway-dark/50 border-railway-gray/30 text-white placeholder:text-railway-gray/40 focus:border-railway-blue h-11 rounded-lg"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-railway-light text-sm">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-railway-gray/50" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="pl-10 bg-railway-dark/50 border-railway-gray/30 text-white placeholder:text-railway-gray/40 focus:border-railway-blue h-11 rounded-lg"
                        />
                      </div>
                      {errors.password && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.password}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm" className="text-railway-light text-sm">
                        Confirm
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-railway-gray/50" />
                        <Input
                          id="signup-confirm"
                          type="password"
                          placeholder="••••••"
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className="pl-10 bg-railway-dark/50 border-railway-gray/30 text-white placeholder:text-railway-gray/40 focus:border-railway-blue h-11 rounded-lg"
                        />
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-railway-blue to-railway-cyan hover:opacity-90 text-white font-semibold rounded-lg transition-all shadow-lg shadow-railway-blue/25"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t border-railway-gray/20">
              <p className="text-center text-xs text-railway-gray">
                Authorized personnel only. All access is logged and monitored.
              </p>
            </div>
          </div>

          <p className="text-center mt-6 text-railway-gray text-sm">
            © 2025 Indian Railways • AI Traffic Control System
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
