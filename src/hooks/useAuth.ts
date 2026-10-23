import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from './useAppSelector';
import { useAppDispatch } from './useAppDispatch';
import { loginStart, loginSuccess, loginFailure, requiresTwoFactor, completeTwoFactor, cancelTwoFactor, logout as logoutAction } from '../store/authSlice';
import * as authApi from '../api/authApi';
import type { LoginRequest, SignupRequest } from '../types';

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, requiresTwoFactor: needsTwoFactor, pendingUsername } = useAppSelector((state) => state.auth);

  const login = useCallback(
    async (data: LoginRequest) => {
      dispatch(loginStart());
      try {
        // Tokens never appear here - login sets httpOnly cookies server-side.
        const response = await authApi.login(data);
        if (response.totpEnabled) {
          // User has 2FA enabled - show OTP verification
          dispatch(requiresTwoFactor(response.username));
        } else {
          // No 2FA - direct login
          dispatch(
            loginSuccess({
              user: {
                id: response.id,
                username: response.username,
                email: response.email,
                role: response.role,
                totpEnabled: response.totpEnabled,
              },
            })
          );
          navigate('/dashboard');
        }
      } catch (error) {
        dispatch(loginFailure());
        throw error;
      }
    },
    [dispatch, navigate]
  );

  const verifyTwoFactor = useCallback(
    async (username: string, code: string) => {
      try {
        const response = await authApi.verify2fa(username, code);
        dispatch(
          completeTwoFactor({
            user: {
              id: response.id,
              username: response.username,
              email: response.email,
              role: response.role,
              totpEnabled: response.totpEnabled,
            },
          })
        );
        navigate('/dashboard');
        return true;
      } catch {
        return false;
      }
    },
    [dispatch, navigate]
  );

  const cancelTwoFactorLogin = useCallback(() => {
    dispatch(cancelTwoFactor());
  }, [dispatch]);

  const signup = useCallback(
    async (data: SignupRequest) => {
      await authApi.signup(data);
      navigate('/login');
    },
    [navigate]
  );

  const logout = useCallback(async () => {
    try {
      // Clears the httpOnly cookies server-side and revokes the refresh
      // token - local state alone can no longer end the session, since this
      // code can't delete an httpOnly cookie itself.
      await authApi.logout();
    } catch {
      // Cookies may already be gone/expired - fine, still clear local state.
    }
    dispatch(logoutAction());
    navigate('/login');
  }, [dispatch, navigate]);

  const checkUsername = useCallback(async (username: string) => {
    return await authApi.checkUsername(username);
  }, []);

  const checkEmail = useCallback(async (email: string) => {
    return await authApi.checkEmail(email);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await authApi.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string, confirmPassword: string) => {
    await authApi.resetPassword(token, newPassword, confirmPassword);
  }, []);

  const sendOtp = useCallback(async (username: string) => {
    await authApi.sendOtp(username);
  }, []);

  const verifyOtp = useCallback(async (username: string, otp: string) => {
    return await authApi.verifyOtp(username, otp);
  }, []);

  const enableTotp = useCallback(async (username: string) => {
    return await authApi.enableTotp(username);
  }, []);

  const verifyTotpSetup = useCallback(async (username: string, code: string) => {
    return await authApi.verifyTotp(username, code);
  }, []);

  const disableTotp = useCallback(async (username: string) => {
    await authApi.disableTotp(username);
  }, []);

  return {
    user, isAuthenticated, loading, needsTwoFactor, pendingUsername,
    login, signup, logout, verifyTwoFactor, cancelTwoFactorLogin,
    checkUsername, checkEmail,
    forgotPassword, resetPassword,
    sendOtp, verifyOtp,
    enableTotp, verifyTotpSetup, disableTotp
  };
}
