import { apiPost } from "@/lib/api/client";
import type {
  GoogleAuthResponse,
  GoogleLoginRequest,
  GoogleSignupRequest,
  LoginRequest,
  ResendOtpRequest,
  ResendOtpResponse,
  SignupRequest,
  SignupResponse,
  TokenResponse,
  VerifyOtpRequest,
  VerifyOtpResponse
} from "@/lib/types/api";

export function signup(payload: SignupRequest) {
  return apiPost<SignupResponse>("/v1/auth/signup", { data: payload });
}

export function verifyOtp(payload: VerifyOtpRequest) {
  return apiPost<VerifyOtpResponse>("/v1/auth/verify-otp", { data: payload });
}

export function resendOtp(payload: ResendOtpRequest) {
  return apiPost<ResendOtpResponse>("/v1/auth/resend-otp", { data: payload });
}

export function login(payload: LoginRequest) {
  return apiPost<TokenResponse>("/v1/auth/token", { data: payload });
}

export function logout(token: string) {
  return apiPost<{ message: string }>("/v1/auth/logout", { token });
}

export function googleSignup(payload: GoogleSignupRequest) {
  return apiPost<GoogleAuthResponse>("/v1/auth/google/signup", { data: payload });
}

export function googleLogin(payload: GoogleLoginRequest) {
  return apiPost<GoogleAuthResponse>("/v1/auth/google/login", { data: payload });
}
