import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';

interface VerifyEmailResponse {
  success: boolean;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export const VerifyEmail: React.FC = () => {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>('');
  const [autoVerified, setAutoVerified] = useState(false);
  const [hasAttemptedVerification, setHasAttemptedVerification] = useState(false);
  const isVerifyingRef = useRef(false);

  // Extract token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (tokenParam && !hasAttemptedVerification) {
      setToken(tokenParam);
      setHasAttemptedVerification(true);
      // Auto-verify if token is in URL
      verifyEmail(tokenParam);
      setAutoVerified(true);
    }
  }, [hasAttemptedVerification]);

  const verifyEmail = async (verificationToken: string) => {
    if (!verificationToken.trim()) {
      setVerificationStatus('error');
      setMessage('Please enter a valid verification token.');
      return;
    }

    // Prevent multiple simultaneous verification attempts
    if (isVerifyingRef.current) {
      console.log('🚫 Verification already in progress, skipping duplicate call');
      return;
    }

    isVerifyingRef.current = true;
    setIsLoading(true);
    setVerificationStatus('pending');

    // Debug logging for development
    console.log('🔍 Frontend verification debug:');
    console.log('Token being sent:', verificationToken);
    console.log('Token length:', verificationToken.length);

    try {
      const response = await fetch('/api/jwt-auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data: VerifyEmailResponse = await response.json();

      if (data.success) {
        setVerificationStatus('success');
        setMessage(data.message || 'Email verified successfully! You can now log in to your account.');
      } else {
        setVerificationStatus('error');
        
        // Handle specific error codes
        switch (data.error?.code) {
          case 'TOKEN_EXPIRED':
            setMessage('Your verification token has expired. Please request a new verification email.');
            break;
          case 'INVALID_TOKEN':
            setMessage('Invalid verification token. Please check your verification link or request a new one.');
            break;
          case 'MISSING_TOKEN':
            setMessage('Verification token is required.');
            break;
          default:
            setMessage(data.error?.message || 'Email verification failed. Please try again.');
        }
      }
    } catch (error) {
      setVerificationStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
      isVerifyingRef.current = false;
    }
  };

  const handleResendEmail = async () => {
    // This would typically require the user's email address
    // For now, redirect to login where they can request a new verification email
    navigate('/login');
  };

  const handleManualVerify = () => {
    if (token.trim() && verificationStatus !== 'success') {
      setHasAttemptedVerification(true);
      verifyEmail(token);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Card className="w-full max-w-md bg-white border-green-100">
          <CardHeader className="text-center">
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <CardTitle className="text-2xl font-bold text-gray-900">
              Verifying Email
            </CardTitle>
            <CardDescription className="text-gray-600">
              Please wait while we verify your email address...
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    if (verificationStatus === 'success') {
      return (
        <Card className="w-full max-w-md bg-white border-green-100">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Email Verified!
            </CardTitle>
            <CardDescription className="text-gray-600">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                Your consultant account is now active and ready to use.
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={() => navigate('/login')} 
                className="w-full"
              >
                Continue to Login
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')} 
                className="w-full"
              >
                Go to Homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (verificationStatus === 'error') {
      return (
        <Card className="w-full max-w-md bg-white border-red-100">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">
              Verification Failed
            </CardTitle>
            <CardDescription className="text-gray-600">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button 
                variant="outline"
                onClick={handleResendEmail} 
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                Request New Verification Email
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/login')} 
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Default state - manual verification
    return (
      <Card className="w-full max-w-md bg-white border-green-100">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-gray-600">
            {autoVerified 
              ? 'We attempted to verify your email automatically. If it failed, you can try again manually.'
              : 'Enter your verification token to activate your consultant account'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Verification Token
            </label>
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter verification token from email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={handleManualVerify}
              disabled={!token.trim() || isLoading || verificationStatus === 'success'}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </Button>
            
            <div className="text-center">
              <button
                onClick={handleResendEmail}
                className="text-sm text-blue-600 hover:underline"
              >
                Didn't receive an email? Request a new one
              </button>
            </div>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-600 hover:underline"
            >
              Back to Login
            </button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-300 flex items-center justify-center px-4">
      {renderContent()}
    </div>
  );
};