import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const Login = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const loginMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/api/token/', { username, password });
            return response.data;
        },
        onSuccess: (data) => {
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);
            localStorage.setItem('is_superuser', String(data.is_superuser));
            localStorage.setItem('user_type', data.user_type || 'qa');
            toast.success('Login successful');
            // Redirect based on role
            if (data.is_superuser || ['quality_head', 'quality_supervisor'].includes(data.user_type)) {
                navigate('/dashboard');
            } else {
                navigate('/evaluation');
            }
        },
        onError: () => {
            toast.error('Invalid credentials');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loginMutation.mutate();
    };

    return (
        <div className="min-h-screen-safe flex items-center justify-center bg-gray-100 px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-xl md:text-2xl">Welcome Back</CardTitle>
                    <CardDescription>Sign in to access the Fit Flow</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="h-12 md:h-10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center mb-1">
                                <Label htmlFor="password">Password</Label>
                                <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
                                    Forgot Password?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="h-12 md:h-10"
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full h-12 md:h-10"
                            disabled={loginMutation.isPending}
                        >
                            {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;
