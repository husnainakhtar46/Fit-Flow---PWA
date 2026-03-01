import { useMutation } from '@tanstack/react-query';
import api from '../../../lib/api';

export const useRequestOTP = () => {
    return useMutation({
        mutationFn: async (email: string) => {
            // Unauthenticated endpoint
            const response = await api.post('/api/auth/request-otp/', { email });
            return response.data;
        }
    });
};

export const useResetPassword = () => {
    return useMutation({
        mutationFn: async (data: { email: string; otpCode: string; newPassword: string }) => {
            // Unauthenticated endpoint
            const response = await api.post('/api/auth/reset-password/', data);
            return response.data;
        }
    });
};
