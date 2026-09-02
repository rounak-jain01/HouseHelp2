import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/otp" />
      <Stack.Screen name="customer/index" />
      <Stack.Screen name="maid/index" />
    </Stack>
  );
}