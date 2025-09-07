import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Link } from 'wouter';
import { Loader2, UserCheck, Stethoscope } from 'lucide-react';

const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  fullName: z.string().min(1, 'Full name is required'),
  specialization: z.enum(['nutritionist', 'veterinarian'], {
    required_error: 'Please select a specialization',
  }),
});

type RegisterForm = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const watchedSpecialization = watch('specialization');

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const result = await registerUser(data);
      if (result.success) {
        setRegisteredEmail(data.email);
        setRegistrationComplete(true);
      } else {
        console.error('Registration failed:', result.error);
      }
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-green-300 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white border-green-100">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Registration Successful!
            </CardTitle>
            <CardDescription className="text-gray-600">
              Please check your email to verify your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                We've sent a verification email to:
              </p>
              <p className="font-medium text-blue-900 mt-1">
                {registeredEmail}
              </p>
            </div>
            <div className="text-center">
              <Link href="/login">
                <Button className="w-full">
                  Continue to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-300 flex items-center justify-center px-4">
      <Card className="w-full max-w-lg bg-white border-green-100">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Join CattleNutrition Pro
          </CardTitle>
          <CardDescription className="text-gray-600">
            Create your professional consultant account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  {...register('fullName')}
                  placeholder="Dr. John Smith"
                  className={errors.fullName ? 'border-red-500' : ''}
                />
                {errors.fullName && (
                  <p className="text-sm text-red-500 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="john@example.com"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...register('username')}
                  placeholder="johnsmith"
                  className={errors.username ? 'border-red-500' : ''}
                />
                {errors.username && (
                  <p className="text-sm text-red-500 mt-1">{errors.username.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="••••••••"
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              <div>
                <Label className="text-base font-medium">Specialization</Label>
                <p className="text-sm text-gray-600 mb-3">
                  What type of consultant are you?
                </p>
                <RadioGroup
                  value={watchedSpecialization}
                  onValueChange={(value) => setValue('specialization', value as 'nutritionist' | 'veterinarian')}
                  className="grid grid-cols-1 gap-4"
                >
                  <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50">
                    <RadioGroupItem value="nutritionist" id="nutritionist" />
                    <div className="flex-1 flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <Label htmlFor="nutritionist" className="font-medium cursor-pointer">
                          Nutritionist
                        </Label>
                        <p className="text-sm text-gray-600">
                          Cattle nutrition specialist
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50">
                    <RadioGroupItem value="veterinarian" id="veterinarian" />
                    <div className="flex-1 flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Stethoscope className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <Label htmlFor="veterinarian" className="font-medium cursor-pointer">
                          Veterinarian
                        </Label>
                        <p className="text-sm text-gray-600">
                          Licensed veterinary professional
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
                {errors.specialization && (
                  <p className="text-sm text-red-500 mt-1">{errors.specialization.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};