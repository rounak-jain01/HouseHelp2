import React, { useEffect, useRef, useState } from "react";
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
import { router } from "expo-router";
import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "@react-native-firebase/firestore";

type MaidData = {
  name?: string;
  phoneNumber?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  serviceCategories?: string[];
  serviceArea?: string;
  isAvailableNow?: boolean;
};

const auth = getAuth();
const db = getFirestore();

export default function MaidHome() {
  const [maid, setMaid] = useState<MaidData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  const openedBookingIdRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribeBookings: (() => void) | undefined;

    const setup = async () => {
      const user = auth.currentUser;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      try {
        const maidRef = doc(db, "maids", user.uid);
        const maidSnapshot = await getDoc(maidRef);

        if (!maidSnapshot.exists()) {
          router.replace({
            pathname: "/maid/profile",
            params: {
              phone: user.phoneNumber || "",
            },
          });
          return;
        }

        const maidData = maidSnapshot.data() as MaidData;

        setMaid(maidData);
        setIsAvailable(maidData.isAvailableNow ?? false);
        setLoading(false);

        /*
         * Only verified maids can receive booking requests.
         */
        if (maidData.verificationStatus !== "verified") {
          return;
        }

        /*
         * Listen for bookings assigned to this maid.
         */
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("maidId", "==", user.uid),
        );

        unsubscribeBookings = onSnapshot(
          bookingsQuery,
          (snapshot) => {
            const assignedBooking = snapshot.docs.find(
              (bookingDoc) =>
                bookingDoc.data()?.status === "assigned",
            );

            if (!assignedBooking) {
              return;
            }

            const bookingId = assignedBooking.id;

            /*
             * Prevent the same booking from opening repeatedly.
             */
            if (openedBookingIdRef.current === bookingId) {
              return;
            }

            openedBookingIdRef.current = bookingId;

            router.push({
              pathname: "/maid/booking-request",
              params: {
                bookingId,
              },
            });
          },
          (error) => {
            console.error(
              "BOOKING LISTENER ERROR:",
              error,
            );
          },
        );
      } catch (error) {
        console.error("MAID HOME ERROR:", error);

        setLoading(false);

        Alert.alert(
          "Something went wrong",
          "Unable to load your profile. Please try again.",
        );
      }
    };

    setup();

    return () => {
      unsubscribeBookings?.();
    };
  }, []);

  const verificationStatus =
    maid?.verificationStatus ?? "pending";

  const isVerified =
    verificationStatus === "verified";

  /*
   * Available Now ON/OFF
   */
  const handleAvailabilityPress = async () => {
    if (!isVerified) {
      Alert.alert(
        "Verification Required",
        "Your account needs to be verified before you can go available and receive bookings.",
        [
          {
            text: "View Verification",
            onPress: () =>
              router.push("/maid/profile"),
          },
          {
            text: "OK",
            style: "cancel",
          },
        ],
      );

      return;
    }

    const user = auth.currentUser;

    if (!user) {
      Alert.alert(
        "Session Expired",
        "Please login again.",
      );

      router.replace("/auth/login");
      return;
    }

    const newAvailability = !isAvailable;

    // Update UI immediately.
    setIsAvailable(newAvailability);

    try {
      await updateDoc(
        doc(db, "maids", user.uid),
        {
          isAvailableNow: newAvailability,
        },
      );

      console.log(
        "AVAILABILITY UPDATED:",
        user.uid,
        "isAvailableNow:",
        newAvailability,
      );
    } catch (error) {
      console.error(
        "AVAILABILITY UPDATE ERROR:",
        error,
      );

      // Rollback UI if Firestore update fails.
      setIsAvailable(!newAvailability);

      Alert.alert(
        "Update Failed",
        "Could not update your availability. Please try again.",
      );
    }
  };

  /*
   * Upcoming Availability Calendar
   */
  const handleUpcomingAvailabilityPress = () => {
    if (!isVerified) {
      Alert.alert(
        "Verification Required",
        "You need to be verified before setting upcoming availability.",
        [
          {
            text: "View Verification",
            onPress: () =>
              router.push("/maid/profile"),
          },
          {
            text: "OK",
            style: "cancel",
          },
        ],
      );

      return;
    }

    router.push("/maid/availability");
  };

  /*
   * Booking list
   */
  const handleBookingPress = () => {
    if (!isVerified) {
      Alert.alert(
        "Verification Required",
        "You need to complete verification before you can receive bookings.",
        [
          {
            text: "View Verification",
            onPress: () =>
              router.push("/maid/profile"),
          },
          {
            text: "OK",
            style: "cancel",
          },
        ],
      );

      return;
    }

    router.push("/maid/bookings");
  };

  const handleProfilePress = () => {
    router.push("/maid/profile");
  };

  const handleHistoryPress = () => {
    router.push("/maid/job-history");
  };

  const handleServicesPress = () => {
    Alert.alert(
      "Coming Next",
      "Services screen will be connected next.",
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading your dashboard...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.smallTitle}>
              Good morning
            </Text>

            <Text style={styles.name}>
              {maid?.name || "Maid"}
            </Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <Text style={styles.profileIcon}>
              👤
            </Text>
          </Pressable>
        </View>

        {/* Verification Pending */}
        {verificationStatus === "pending" && (
          <View style={styles.warningCard}>
            <View
              style={
                styles.warningIconContainer
              }
            >
              <Text style={styles.warningIcon}>
                !
              </Text>
            </View>

            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>
                Verification Pending
              </Text>

              <Text style={styles.warningText}>
                Your profile is under verification.
                You can explore the app, but
                bookings will be available after
                verification.
              </Text>

              <Pressable
                style={
                  styles.viewVerificationButton
                }
                onPress={handleProfilePress}
              >
                <Text
                  style={
                    styles.viewVerificationText
                  }
                >
                  View Verification
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Verification Rejected */}
        {verificationStatus === "rejected" && (
          <View style={styles.rejectedCard}>
            <View
              style={
                styles.rejectedIconContainer
              }
            >
              <Text style={styles.rejectedIcon}>
                !
              </Text>
            </View>

            <View style={styles.warningContent}>
              <Text style={styles.rejectedTitle}>
                Verification Rejected
              </Text>

              <Text style={styles.warningText}>
                Your verification needs attention.
                Open your profile to review and
                update your details.
              </Text>

              <Pressable
                style={
                  styles.viewVerificationButton
                }
                onPress={handleProfilePress}
              >
                <Text
                  style={
                    styles.viewVerificationText
                  }
                >
                  Review Profile
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Verified */}
        {verificationStatus === "verified" && (
          <View style={styles.verifiedCard}>
            <View
              style={
                styles.verifiedIconContainer
              }
            >
              <Text style={styles.verifiedIcon}>
                ✓
              </Text>
            </View>

            <View style={styles.verifiedContent}>
              <Text style={styles.verifiedTitle}>
                You're Verified
              </Text>

              <Text style={styles.verifiedText}>
                Your account is ready to receive
                bookings.
              </Text>
            </View>
          </View>
        )}

        {/* Availability */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Availability
          </Text>

          <Text
            style={[
              styles.availabilityStatus,
              isAvailable
                ? styles.availableText
                : styles.unavailableText,
            ]}
          >
            {isAvailable
              ? "Available"
              : "Offline"}
          </Text>
        </View>

        {/* Available Now Toggle */}
        <Pressable
          style={[
            styles.availabilityCard,
            isAvailable &&
              styles.availabilityCardActive,
          ]}
          onPress={handleAvailabilityPress}
        >
          <View style={styles.availabilityLeft}>
            <View
              style={[
                styles.statusDot,
                isAvailable
                  ? styles.statusDotActive
                  : styles.statusDotInactive,
              ]}
            />

            <View>
              <Text
                style={styles.availabilityTitle}
              >
                {isAvailable
                  ? "You are available"
                  : "You're offline"}
              </Text>

              <Text
                style={
                  styles.availabilitySubtitle
                }
              >
                {isAvailable
                  ? "You can receive new booking requests"
                  : "Turn on availability to receive bookings"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.toggle,
              isAvailable &&
                styles.toggleActive,
            ]}
          >
            <View
              style={[
                styles.toggleCircle,
                isAvailable &&
                  styles.toggleCircleActive,
              ]}
            />
          </View>
        </Pressable>

        {/* Upcoming Availability */}
        <Pressable
          style={
            styles.upcomingAvailabilityCard
          }
          onPress={
            handleUpcomingAvailabilityPress
          }
        >
          <View
            style={
              styles.upcomingIconContainer
            }
          >
            <Text style={styles.upcomingIcon}>
              📅
            </Text>
          </View>

          <View
            style={styles.upcomingContent}
          >
            <Text
              style={styles.upcomingTitle}
            >
              Set Upcoming Availability
            </Text>

            <Text
              style={
                styles.upcomingSubtitle
              }
            >
              Choose dates and time slots for
              future bookings
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </Pressable>

        {/* Bookings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Bookings
          </Text>
        </View>

        <Pressable
          style={[
            styles.bookingCard,
            !isVerified &&
              styles.bookingCardLocked,
          ]}
          onPress={handleBookingPress}
        >
          <View
            style={
              styles.bookingIconContainer
            }
          >
            <Text style={styles.bookingIcon}>
              📋
            </Text>
          </View>

          <View
            style={styles.bookingContent}
          >
            <Text style={styles.bookingTitle}>
              Bookings
            </Text>

            <Text
              style={styles.bookingSubtitle}
            >
              {isVerified
                ? "View your assigned and active bookings"
                : "Verification required to receive bookings"}
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>

          {!isVerified && (
            <View style={styles.lockBadge}>
              <Text style={styles.lockText}>
                🔒
              </Text>
            </View>
          )}
        </Pressable>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Quick Actions
          </Text>
        </View>

        <View style={styles.quickActions}>
          <Pressable
            style={styles.quickCard}
            onPress={handleServicesPress}
          >
            <Text style={styles.quickIcon}>
              🧹
            </Text>

            <Text style={styles.quickTitle}>
              My Services
            </Text>

            <Text
              style={styles.quickSubtitle}
            >
              {maid?.serviceCategories
                ?.length || 0}{" "}
              services
            </Text>
          </Pressable>

          <Pressable
            style={styles.quickCard}
            onPress={handleHistoryPress}
          >
            <Text style={styles.quickIcon}>
              📜
            </Text>

            <Text style={styles.quickTitle}>
              Job History
            </Text>

            <Text
              style={styles.quickSubtitle}
            >
              View completed jobs
            </Text>
          </Pressable>
        </View>

        {/* Service Area */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Service Area
          </Text>
        </View>

        <View style={styles.areaCard}>
          <Text style={styles.locationIcon}>
            📍
          </Text>

          <View style={styles.areaContent}>
            <Text style={styles.areaTitle}>
              Current Service Area
            </Text>

            <Text style={styles.areaText}>
              {maid?.serviceArea || "Not set"}
            </Text>
          </View>
        </View>

        {/* Profile */}
        <Pressable
          style={styles.profileCard}
          onPress={handleProfilePress}
        >
          <View
            style={styles.profileCardIcon}
          >
            <Text
              style={styles.profileCardEmoji}
            >
              👤
            </Text>
          </View>

          <View
            style={styles.profileCardContent}
          >
            <Text
              style={styles.profileCardTitle}
            >
              My Profile
            </Text>

            <Text
              style={
                styles.profileCardSubtitle
              }
            >
              View and update your profile
              information
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </Pressable>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem}>
          <Text
            style={styles.navIconActive}
          >
            ⌂
          </Text>

          <Text
            style={styles.navTextActive}
          >
            Home
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={handleBookingPress}
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
          onPress={handleProfilePress}
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

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  smallTitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },

  name: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },

  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },

  profileIcon: {
    fontSize: 21,
  },

  warningCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFF7E8",
    marginBottom: 22,
  },

  rejectedCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FDECEC",
    marginBottom: 22,
  },

  warningIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  rejectedIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  warningIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  rejectedIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  warningContent: {
    flex: 1,
  },

  warningTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 5,
  },

  rejectedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 5,
  },

  warningText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
  },

  viewVerificationButton: {
    alignSelf: "flex-start",
    marginTop: 11,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },

  viewVerificationText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },

  verifiedCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#ECFDF3",
    marginBottom: 22,
  },

  verifiedIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  verifiedIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  verifiedContent: {
    flex: 1,
  },

  verifiedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 5,
  },

  verifiedText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#4B5563",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  availabilityStatus: {
    fontSize: 13,
    fontWeight: "600",
  },

  availableText: {
    color: "#16A34A",
  },

  unavailableText: {
    color: "#6B7280",
  },

  availabilityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    elevation: 1,
  },

  availabilityCardActive: {
    borderWidth: 1,
    borderColor: "#86EFAC",
  },

  availabilityLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },

  statusDotActive: {
    backgroundColor: "#16A34A",
  },

  statusDotInactive: {
    backgroundColor: "#9CA3AF",
  },

  availabilityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  availabilitySubtitle: {
    fontSize: 12,
    color: "#6B7280",
    maxWidth: 220,
  },

  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#D1D5DB",
    padding: 3,
    justifyContent: "center",
  },

  toggleActive: {
    backgroundColor: "#22C55E",
  },

  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },

  toggleCircleActive: {
    alignSelf: "flex-end",
  },

  /* Upcoming Availability */

  upcomingAvailabilityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
  },

  upcomingIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  upcomingIcon: {
    fontSize: 22,
  },

  upcomingContent: {
    flex: 1,
  },

  upcomingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  upcomingSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7280",
    paddingRight: 8,
  },

  bookingCard: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 22,
    elevation: 1,
  },

  bookingCardLocked: {
    backgroundColor: "#F9FAFB",
  },

  bookingIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  bookingIcon: {
    fontSize: 21,
  },

  bookingContent: {
    flex: 1,
  },

  bookingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  bookingSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7280",
    paddingRight: 8,
  },

  arrow: {
    fontSize: 28,
    color: "#9CA3AF",
  },

  lockBadge: {
    position: "absolute",
    right: 48,
    top: 10,
  },

  lockText: {
    fontSize: 13,
  },

  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },

  quickCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    minHeight: 125,
    elevation: 1,
  },

  quickIcon: {
    fontSize: 25,
    marginBottom: 12,
  },

  quickTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 5,
  },

  quickSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7280",
  },

  areaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
  },

  locationIcon: {
    fontSize: 25,
    marginRight: 12,
  },

  areaContent: {
    flex: 1,
  },

  areaTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  areaText: {
    fontSize: 12,
    color: "#6B7280",
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    elevation: 1,
  },

  profileCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  profileCardEmoji: {
    fontSize: 21,
  },

  profileCardContent: {
    flex: 1,
  },

  profileCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  profileCardSubtitle: {
    fontSize: 12,
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
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },

  navIconActive: {
    fontSize: 22,
    marginBottom: 4,
  },

  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },

  navTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
  },

  navText: {
    fontSize: 11,
    color: "#6B7280",
  },
});