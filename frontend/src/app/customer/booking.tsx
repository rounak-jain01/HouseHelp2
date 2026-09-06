import React, { useEffect, useMemo, useState } from "react";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";

import { getAuth } from "@react-native-firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  Timestamp,
} from "@react-native-firebase/firestore";

type Category = {
  id: string;
  name: string;
  ratePerHour: number;
  isActive: boolean;
};

type CustomerAddress = {
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  landmark?: string | null;
};

type CustomerData = {
  name?: string;
  address?: CustomerAddress;
};

const auth = getAuth();
const db = getFirestore();

export default function CustomerBooking() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [customer, setCustomer] = useState<CustomerData | null>(null);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [duration, setDuration] = useState<number | null>(null);

  const [bookingDateTime, setBookingDateTime] = useState(
    new Date(Date.now() + 2 * 60 * 60 * 1000),
  );

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [showTimePicker, setShowTimePicker] = useState(false);

  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    loadBookingData();
  }, []);

  const loadBookingData = async () => {
    try {
      setLoading(true);
      setError("");

      const user = auth.currentUser;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // Customer
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

      // Categories
      const categoriesSnapshot = await getDocs(collection(db, "categories"));

      const loadedCategories: Category[] = categoriesSnapshot.docs
        .map((item) => {
          const data = item.data();

          return {
            id: item.id,
            name: String(data.name || item.id),
            ratePerHour: Number(data.ratePerHour || 0),
            isActive: data.isActive !== false,
          };
        })
        .filter((category) => category.isActive);

      setCategories(loadedCategories);
    } catch (err) {
      console.error("BOOKING LOAD ERROR:", err);

      setError("Unable to load booking details.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((previous) =>
      previous.includes(categoryId)
        ? previous.filter((id) => id !== categoryId)
        : [...previous, categoryId],
    );
  };

  const totalPrice = useMemo(() => {
    if (!duration || selectedCategories.length === 0) {
      return 0;
    }

    const hourlyRate = selectedCategories.reduce((total, categoryId) => {
      const category = categories.find((item) => item.id === categoryId);

      return total + (category?.ratePerHour || 0);
    }, 0);

    return hourlyRate * duration;
  }, [categories, selectedCategories, duration]);

  const minimumBookingTime = Date.now() + 2 * 60 * 60 * 1000;

  const isTimeValid = bookingDateTime.getTime() >= minimumBookingTime;

  const hasAddress = !!customer?.address?.formattedAddress;

  const isFormValid =
    selectedCategories.length > 0 &&
    duration !== null &&
    isTimeValid &&
    hasAddress;

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);

    if (!selectedDate) {
      return;
    }

    const updatedDate = new Date(bookingDateTime);

    updatedDate.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    );

    setBookingDateTime(updatedDate);
  };

  const handleTimeChange = (_event: any, selectedTime?: Date) => {
    setShowTimePicker(false);

    if (!selectedTime) {
      return;
    }

    const updatedDate = new Date(bookingDateTime);

    updatedDate.setHours(
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
      0,
    );

    setBookingDateTime(updatedDate);
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });

  const createBooking = async () => {
    if (!isFormValid) {
      if (selectedCategories.length === 0) {
        Alert.alert("Select a Service", "Please select at least one service.");
        return;
      }

      if (!duration) {
        Alert.alert("Select Duration", "Please select booking duration.");
        return;
      }

      if (!isTimeValid) {
        Alert.alert(
          "Invalid Time",
          "Please select a time at least 2 hours from now.",
        );
        return;
      }

      if (!hasAddress) {
        Alert.alert(
          "Address Required",
          "Please add your service address first.",
        );
        return;
      }

      return;
    }

    try {
      setBookingLoading(true);

      const user = auth.currentUser;

      if (!user) {
        throw new Error("Customer session not found.");
      }

      const bookingCategories = selectedCategories
        .map((categoryId) => categories.find((item) => item.id === categoryId))
        .filter((category): category is Category => Boolean(category))
        .map((category) =>
          category.name
            .trim()
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
        );

      const bookingData = {
        customerId: user.uid,

        maidId: null,

        categories: bookingCategories,

        duration,

        scheduledDateTime: Timestamp.fromDate(bookingDateTime),

        totalPrice,

        status: "pending",

        customerAddress: {
          formattedAddress: customer?.address?.formattedAddress || "",

          latitude: customer?.address?.latitude ?? null,

          longitude: customer?.address?.longitude ?? null,

          landmark: customer?.address?.landmark || null,
        },

        customerName: customer?.name || "",

        createdAt: Timestamp.now(),
      };

      const bookingRef = await addDoc(collection(db, "bookings"), bookingData);

      console.log("BOOKING CREATED:", bookingRef.id);

      router.replace({
        pathname: "/customer/waiting",
        params: {
          bookingId: bookingRef.id,
        },
      });
    } catch (err) {
      console.error("CREATE BOOKING ERROR:", err);

      Alert.alert(
        "Booking Failed",
        "Unable to create your booking. Please try again.",
      );
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>Loading booking details...</Text>
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
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Book a Helper</Text>

            <Text style={styles.subtitle}>Choose what you need help with</Text>
          </View>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable onPress={loadBookingData}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What do you need help with?</Text>

          <Text style={styles.sectionSubtitle}>
            Select one or more services
          </Text>

          <View style={styles.chipContainer}>
            {categories.map((category) => {
              const selected = selectedCategories.includes(category.id);

              return (
                <Pressable
                  key={category.id}
                  onPress={() => toggleCategory(category.id)}
                  style={[
                    styles.categoryChip,
                    selected && styles.categoryChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selected && styles.categoryTextSelected,
                    ]}
                  >
                    {selected ? "✓ " : ""}
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {categories.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No services available</Text>

              <Text style={styles.emptyText}>
                Add active categories from the Admin Panel.
              </Text>
            </View>
          )}
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>

          <View style={styles.chipContainer}>
            {[1, 2, 3, 4].map((hours) => {
              const selected = duration === hours;

              return (
                <Pressable
                  key={hours}
                  onPress={() => setDuration(hours)}
                  style={[
                    styles.durationChip,
                    selected && styles.durationChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.durationText,
                      selected && styles.durationTextSelected,
                    ]}
                  >
                    {hours} hr
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>

          <Text style={styles.sectionSubtitle}>
            Booking must be at least 2 hours from now
          </Text>

          <View style={styles.dateTimeRow}>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={styles.dateTimeButton}
            >
              <Text style={styles.dateTimeLabel}>DATE</Text>

              <Text style={styles.dateTimeValue}>
                {formatDate(bookingDateTime)}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={styles.dateTimeButton}
            >
              <Text style={styles.dateTimeLabel}>TIME</Text>

              <Text style={styles.dateTimeValue}>
                {formatTime(bookingDateTime)}
              </Text>
            </Pressable>
          </View>

          {!isTimeValid && (
            <View style={styles.validationCard}>
              <Text style={styles.validationText}>
                Please select a time at least 2 hours from now.
              </Text>
            </View>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={bookingDateTime}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={bookingDateTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {/* Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Service Address</Text>

            <Pressable onPress={() => router.push("/customer/profile")}>
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>

          <View style={styles.addressCard}>
            <Text style={styles.locationIcon}>📍</Text>

            <View style={styles.addressContent}>
              <Text style={styles.addressText}>
                {customer?.address?.formattedAddress || "No address added"}
              </Text>

              {customer?.address?.landmark ? (
                <Text style={styles.landmarkText}>
                  Landmark: {customer.address.landmark}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceCard}>
          <View>
            <Text style={styles.priceLabel}>Total Price</Text>

            <Text style={styles.priceSubtext}>
              Selected services × {duration || 0} hour
              {duration === 1 ? "" : "s"}
            </Text>
          </View>

          <Text style={styles.price}>₹{totalPrice}</Text>
        </View>

        {/* Confirm */}
        <Pressable
          disabled={!isFormValid || bookingLoading}
          onPress={createBooking}
          style={[
            styles.confirmButton,
            (!isFormValid || bookingLoading) && styles.confirmButtonDisabled,
          ]}
        >
          {bookingLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Booking</Text>
          )}
        </Pressable>

        {!isFormValid && (
          <Text style={styles.bottomHint}>
            Select service, duration, a valid time and address to continue.
          </Text>
        )}
      </ScrollView>
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
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 26,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  backText: {
    fontSize: 30,
    color: "#111827",
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },

  errorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },

  errorText: {
    fontSize: 13,
    color: "#B91C1C",
  },

  retryText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  section: {
    marginBottom: 24,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
  },

  changeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  categoryChipSelected: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },

  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },

  categoryTextSelected: {
    color: "#FFFFFF",
  },

  durationChip: {
    minWidth: 70,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  durationChipSelected: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },

  durationText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },

  durationTextSelected: {
    color: "#FFFFFF",
  },

  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },

  dateTimeButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  dateTimeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 6,
  },

  dateTimeValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },

  validationCard: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#FFF7E8",
    borderRadius: 12,
  },

  validationText: {
    fontSize: 12,
    color: "#B45309",
  },

  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  locationIcon: {
    fontSize: 22,
    marginRight: 12,
  },

  addressContent: {
    flex: 1,
  },

  addressText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
    fontWeight: "500",
  },

  landmarkText: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
  },

  priceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  priceLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  priceSubtext: {
    marginTop: 4,
    fontSize: 11,
    color: "#6B7280",
  },

  price: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },

  confirmButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  confirmButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },

  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  bottomHint: {
    marginTop: 10,
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  emptyText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
  },
});
