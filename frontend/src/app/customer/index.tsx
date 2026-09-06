import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Href, router } from "expo-router";

import { getAuth } from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
} from "@react-native-firebase/firestore";

const auth = getAuth();
const db = getFirestore();

type CustomerData = {
  userId?: string;
  role?: string;
  phoneNumber?: string;
  name?: string;
  address?: {
    formattedAddress?: string;
    latitude?: number;
    longitude?: number;
    landmark?: string | null;
  };
};

export default function CustomerHome() {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerProfile();
  }, []);

  const loadCustomerProfile = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const customerRef = doc(db, "users", user.uid);
      const customerSnapshot = await getDoc(customerRef);

      if (!customerSnapshot.exists()) {
        router.replace({
          pathname: "/customer/profile",
          params: {
            phone: user.phoneNumber || "",
          },
        });
        return;
      }

      setCustomer(customerSnapshot.data() as CustomerData);
    } catch (error) {
      console.error("CUSTOMER HOME ERROR:", error);

      Alert.alert(
        "Something went wrong",
        "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBookHelper = () => {
    router.push("/customer/booking");
  };

  const handleBookings = () => {
    router.push("/customer/bookings" as Href);
  };

  const handleProfile = () => {
    router.push("/customer/profile");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading your home...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>
              Hi {customer?.name || "there"} 👋
            </Text>

            <Text style={styles.headerSubtitle}>
              What can we help you with today?
            </Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={handleProfile}
          >
            <Text style={styles.profileIcon}>👤</Text>
          </Pressable>
        </View>

        {/* Address */}
        <Pressable
          style={styles.addressCard}
          onPress={handleProfile}
        >
          <View style={styles.locationCircle}>
            <Text style={styles.locationIcon}>📍</Text>
          </View>

          <View style={styles.addressContent}>
            <Text style={styles.addressLabel}>
              Service Address
            </Text>

            <Text
              style={styles.addressText}
              numberOfLines={2}
            >
              {customer?.address?.formattedAddress ||
                "Add your address"}
            </Text>
          </View>

          <Text style={styles.changeText}>
            Change
          </Text>
        </Pressable>

        {/* Book Helper */}
        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              Need a helping hand?
            </Text>

            <Text style={styles.heroSubtitle}>
              Book a trusted helper for cleaning, cooking,
              laundry and more.
            </Text>

            <Pressable
              style={styles.bookButton}
              onPress={handleBookHelper}
            >
              <Text style={styles.bookButtonText}>
                Book a Helper
              </Text>

              <Text style={styles.bookButtonArrow}>
                →
              </Text>
            </Pressable>
          </View>

          <View style={styles.heroIconContainer}>
            <Text style={styles.heroIcon}>🏠</Text>
          </View>
        </View>

        {/* Active Booking */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Active Booking
          </Text>

          <Pressable onPress={handleBookings}>
            <Text style={styles.seeAllText}>
              View All
            </Text>
          </Pressable>
        </View>

        <View style={styles.emptyBookingCard}>
          <View style={styles.emptyBookingIconContainer}>
            <Text style={styles.emptyBookingIcon}>
              📋
            </Text>
          </View>

          <View style={styles.emptyBookingContent}>
            <Text style={styles.emptyBookingTitle}>
              No active booking
            </Text>

            <Text style={styles.emptyBookingText}>
              Your current bookings will appear here.
            </Text>
          </View>
        </View>

        {/* Popular Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Popular Services
          </Text>

          <Pressable onPress={handleBookHelper}>
            <Text style={styles.seeAllText}>
              See All
            </Text>
          </Pressable>
        </View>

        <View style={styles.servicesRow}>
          <Pressable
            style={styles.serviceCard}
            onPress={handleBookHelper}
          >
            <View style={styles.serviceIconContainer}>
              <Text style={styles.serviceIcon}>🧹</Text>
            </View>

            <Text style={styles.serviceTitle}>
              Cleaning
            </Text>

            <Text style={styles.serviceSubtitle}>
              Cleaning help
            </Text>
          </Pressable>

          <Pressable
            style={styles.serviceCard}
            onPress={handleBookHelper}
          >
            <View style={styles.serviceIconContainer}>
              <Text style={styles.serviceIcon}>🍳</Text>
            </View>

            <Text style={styles.serviceTitle}>
              Cooking
            </Text>

            <Text style={styles.serviceSubtitle}>
              Cooking help
            </Text>
          </Pressable>

          <Pressable
            style={styles.serviceCard}
            onPress={handleBookHelper}
          >
            <View style={styles.serviceIconContainer}>
              <Text style={styles.serviceIcon}>🧺</Text>
            </View>

            <Text style={styles.serviceTitle}>
              Laundry
            </Text>

            <Text style={styles.serviceSubtitle}>
              Laundry help
            </Text>
          </Pressable>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Text style={styles.infoIcon}>
              ✓
            </Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Verified Helpers
            </Text>

            <Text style={styles.infoText}>
              HouseHelp connects you with verified helpers
              available in your area.
            </Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem}>
          <Text style={styles.navIconActive}>⌂</Text>
          <Text style={styles.navTextActive}>
            Home
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={handleBookings}
        >
          <Text style={styles.navIcon}>
            📋
          </Text>

          <Text style={styles.navText}>
            Bookings
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={handleProfile}
        >
          <Text style={styles.navIcon}>
            👤
          </Text>

          <Text style={styles.navText}>
            Profile
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 110,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 16,
  },

  greeting: {
    fontSize: 25,
    fontWeight: "700",
    color: "#111827",
  },

  headerSubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: "#6B7280",
  },

  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },

  profileIcon: {
    fontSize: 21,
  },

  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },

  locationCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  locationIcon: {
    fontSize: 18,
  },

  addressContent: {
    flex: 1,
  },

  addressLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 3,
  },

  addressText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: "#111827",
  },

  changeText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },

  heroCard: {
    minHeight: 190,
    borderRadius: 22,
    backgroundColor: "#111827",
    padding: 20,
    marginBottom: 25,
    flexDirection: "row",
    overflow: "hidden",
  },

  heroContent: {
    flex: 1,
    justifyContent: "space-between",
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    maxWidth: 220,
  },

  heroSubtitle: {
    color: "#D1D5DB",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 230,
  },

  heroIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: 20,
  },

  heroIcon: {
    fontSize: 30,
  },

  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
    marginTop: 16,
  },

  bookButtonText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },

  bookButtonArrow: {
    marginLeft: 9,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  seeAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },

  emptyBookingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 16,
    marginBottom: 25,
  },

  emptyBookingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  emptyBookingIcon: {
    fontSize: 21,
  },

  emptyBookingContent: {
    flex: 1,
  },

  emptyBookingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  emptyBookingText: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },

  servicesRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 25,
  },

  serviceCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
  },

  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  serviceIcon: {
    fontSize: 20,
  },

  serviceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  serviceSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#9CA3AF",
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 15,
  },

  infoIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  infoIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: "#16A34A",
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  infoText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 17,
    color: "#6B7280",
  },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 8,
  },

  navItem: {
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },

  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },

  navIconActive: {
    fontSize: 21,
    marginBottom: 4,
  },

  navText: {
    fontSize: 11,
    color: "#6B7280",
  },

  navTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
  },
});