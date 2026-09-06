import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/otp" />
      <Stack.Screen name="auth/role" />

      <Stack.Screen name="customer" />
      <Stack.Screen name="customer/profile" />

      <Stack.Screen name="maid" />
    </Stack>
  );
}