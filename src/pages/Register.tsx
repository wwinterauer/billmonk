import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles, Eye, EyeOff, Loader2, Mail, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const registerSchema = z.object({
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen haben'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen haben'),
  email: z.string().email('Bitte gültige E-Mail eingeben'),
  password: z.string()
    .min(8, 'Passwort muss mindestens 8 Zeichen haben')
    .regex(/[A-Z]/, 'Passwort muss mindestens einen Großbuchstaben enthalten')
    .regex(/[0-9]/, 'Passwort muss mindestens eine Zahl enthalten'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, 'Du musst die AGB akzeptieren'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const password = form.watch('password');

  const passwordRequirements = [
    { met: password.length >= 8, text: 'Mindestens 8 Zeichen' },
    { met: /[A-Z]/.test(password), text: 'Ein Großbuchstabe' },
    { met: /[0-9]/.test(password), text: 'Eine Zahl' },
  ];

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, data.firstName, data.lastName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          variant: 'destructive',
          title: 'E-Mail bereits registriert',
          description: 'Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Registrierung fehlgeschlagen',
          description: error.message,
        });
      }
    } else {
      toast({
        title: 'Konto erstellt!',
        description: 'Du wirst zum Dashboard weitergeleitet...',
      });
      navigate('/dashboard');
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Google-Registrierung fehlgeschlagen',
        description: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">XpenzAi</span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Konto erstellen</h1>
            <p className="text-muted-foreground">Starte mit 10 kostenlosen Belegen</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vorname</FormLabel>
                        <FormControl>
                          <Input placeholder="Max" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nachname</FormLabel>
                        <FormControl>
                          <Input placeholder="Mustermann" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="max@beispiel.de" 
                          {...field} 
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            className="h-11 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      {password && (
                        <div className="mt-2 space-y-1">
                          {passwordRequirements.map((req, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              {req.met ? (
                                <Check className="h-3 w-3 text-success" />
                              ) : (
                                <X className="h-3 w-3 text-destructive" />
                              )}
                              <span className={req.met ? 'text-success' : 'text-muted-foreground'}>
                                {req.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort wiederholen</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            className="h-11 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer leading-tight">
                        Ich akzeptiere die{' '}
                        <Link to="/datenschutz" className="text-primary hover:underline">AGB</Link>
                        {' '}und{' '}
                        <Link to="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</Link>
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-11 gradient-primary hover:opacity-90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Konto erstellen...
                    </>
                  ) : (
                    'Konto erstellen'
                  )}
                </Button>
              </form>
            </Form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">oder</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-11"
              onClick={handleGoogleSignIn}
            >
              <Mail className="mr-2 h-4 w-4" />
              Mit Google registrieren
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Bereits ein Konto?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Anmelden
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
