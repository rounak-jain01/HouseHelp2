import { getApp } from "@react-native-firebase/app";
import {
  getAuth,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "@react-native-firebase/auth";

const auth = getAuth(getApp());

let confirmationResult: ConfirmationResult | null = null;

export const sendOTP = async (phoneNumber: string) => {
  confirmationResult = await signInWithPhoneNumber(
    auth,
    phoneNumber
  );

  console.log("OTP session created");
};

export const verifyOTP = async (code: string) => {
  if (!confirmationResult) {
    throw new Error(
      "OTP session not found. Please request a new OTP."
    );
  }

  const cleanCode = code.trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error("Please enter the 6-digit OTP.");
  }

  const result = await confirmationResult.confirm(cleanCode);

  confirmationResult = null;

  return result.user;
};