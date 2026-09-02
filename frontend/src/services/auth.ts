import { getApp } from "@react-native-firebase/app";
import {
  getAuth,
  signInWithPhoneNumber,
} from "@react-native-firebase/auth";

const app = getApp();
const auth = getAuth(app);

let confirmationResult: any = null;

export const sendOTP = async (phoneNumber: string) => {
  confirmationResult = await signInWithPhoneNumber(
    auth,
    phoneNumber
  );
};

export const verifyOTP = async (code: string) => {
  if (!confirmationResult) {
    throw new Error("OTP session expired. Please request a new OTP.");
  }

  const result = await confirmationResult.confirm(code);

  confirmationResult = null;

  return result.user;
};