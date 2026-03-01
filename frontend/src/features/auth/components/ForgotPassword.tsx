import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { useRequestOTP } from '../hooks/usePasswordReset';

export const ForgotPassword = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const requestOTP = useRequestOTP();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('Please enter your email address');
            return;
        }

        requestOTP.mutate(email, {
            onSuccess: () => {
                toast.success('Verification code sent to your email!');
                // Pass email state to the next screen so user doesn't have to re-type it
                navigate('/verify-reset-password', { state: { email } });
            },
            onError: (error: Error | any) => {
                const errorMessage = error?.response?.data?.error || 'Failed to send verification code. Please try again.';
                toast.error(errorMessage);
            }
        });
    };

    return (
        <div className="min-h-screen-safe flex items-center justify-center bg-gray-100 px-4">
            <Card className="w-full max-w-md shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="space-y-2 pb-6 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Reset Password</CardTitle>
                    <CardDescription className="text-gray-500 text-sm">
                        Enter your email address and we'll send you a 6-digit verification code.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="h-12 w-full transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full h-12 text-md font-medium transition-all duration-200 shadow-sm hover:shadow-md bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={requestOTP.isPending}
                        >
                            {requestOTP.isPending ? 'Sending Code...' : 'Send Verification Code'}
                        </Button>
                        <div className="pt-2 text-center text-sm">
                            <Link to="/login" className="text-blue-600 hover:text-blue-500 font-medium transition-colors">
                                Back to Log In
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};
