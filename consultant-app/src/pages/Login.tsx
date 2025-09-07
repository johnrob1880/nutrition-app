import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useLocation } from 'wouter';
import { Loader2, AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setLoginError('');
    
    try {
      // Determine if identifier is email or username
      const isEmail = data.identifier.includes('@');
      const credentials = isEmail
        ? { email: data.identifier, password: data.password }
        : { username: data.identifier, password: data.password };

      const result = await login(credentials);
      
      if (result?.success) {
        // Add a small delay to ensure auth state is updated before redirect
        setTimeout(() => {
          setLocation('/dashboard');
        }, 100);
      } else {
        setLoginError(result?.error || 'Login failed');
      }
    } catch (error: any) {
      setLoginError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-gray-600">
            Sign in to your consultant account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {loginError && (
              <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <Label htmlFor="identifier">Username or Email</Label>
              <Input
                id="identifier"
                {...register('identifier')}
                placeholder="Enter username or email"
                className={errors.identifier ? 'border-red-500' : ''}
              />
              {errors.identifier && (
                <p className="text-sm text-red-500 mt-1">{errors.identifier.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="Enter your password"
                className={errors.password ? 'border-red-500' : ''}
              />
              {errors.password && (
                <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Create one
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};