import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

type AvailabilitySlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

type AvailabilityOverride = "manual_off" | "manual_on" | null;

type MaidData = {
  name?: string;
  phoneNumber?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  serviceCategories?: string[];
  serviceArea?: string;

  isAvailableNow?: boolean;

  availabilitySlots?: AvailabilitySlot[];

  availabilityOverride?: AvailabilityOverride;
};

const auth = getAuth();
const db = getFirestore();

/* --------------------------------------------------
   Helpers
-------------------------------------------------- */

const pad = (value: number) => {
  return value.toString().padStart(2, "0");
};

const getDateKey = (date: Date) => {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1,
  )}-${pad(date.getDate())}`;
};

const getMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

/* --------------------------------------------------
   Dynamic Greeting
-------------------------------------------------- */

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  if (hour >= 17 && hour < 21) {
    return "Good evening";
  }

  return "Good night";
};

/* --------------------------------------------------
   Availability Helpers
-------------------------------------------------- */

const getActiveAvailabilitySlot = (
  slots: AvailabilitySlot[] = [],
  now = new Date(),
) => {
  const today = getDateKey(now);

  const currentMinutes =
    now.getHours() * 60 + now.getMinutes();

  return slots.find((slot) => {
    if (slot.date !== today) {
      return false;
    }

    const start = getMinutes(slot.startTime);
    const end = getMinutes(slot.endTime);

    return (
      currentMinutes >= start &&
      currentMinutes < end
    );
  });
};

const calculateAvailability = (
  maidData: MaidData,
  now = new Date(),
) => {
  const activeSlot = getActiveAvailabilitySlot(
    maidData.availabilitySlots || [],
    now,
  );

  const override =
    maidData.availabilityOverride ?? null;

  /*
   * Scheduled slot is currently active.
   *
   * Default → ON
   * Manual OFF → OFF
   */

  if (activeSlot) {
    return override !== "manual_off";
  }

  /*
   * No scheduled slot is active.
   *
   * Only manual ON keeps maid available.
   */

  return override === "manual_on";
};

/* --------------------------------------------------
   Maid Home
-------------------------------------------------- */

export default function MaidHome() {
  const [maid, setMaid] =
    useState<MaidData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [isAvailable, setIsAvailable] =
    useState(false);

  const [greeting, setGreeting] =
    useState(getGreeting());

  const openedBookingIdRef =
    useRef<string | null>(null);

  /* --------------------------------------------------
     Dynamic Greeting Effect
  -------------------------------------------------- */

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getGreeting());
    };

    updateGreeting();

    const interval = setInterval(
      updateGreeting,
      60 * 1000,
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* --------------------------------------------------
     Load Maid Data
  -------------------------------------------------- */

  useEffect(() => {
    let unsubscribeMaid:
      | (() => void)
      | undefined;

    let unsubscribeBookings:
      | (() => void)
      | undefined;

    let cleanupInterval:
      | (() => void)
      | undefined;

    const setup = async () => {
      const user = auth.currentUser;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      try {
        const maidRef = doc(
          db,
          "maids",
          user.uid,
        );

        const maidSnapshot =
          await getDoc(maidRef);

        /* ------------------------------------------
           Maid document does not exist
        ------------------------------------------ */

        if (!maidSnapshot.exists()) {
          router.replace({
            pathname: "/maid/profile",
            params: {
              phone: user.phoneNumber || "",
            },
          });

          return;
        }

        const initialData =
          maidSnapshot.data() as MaidData;

        const initialAvailability =
          calculateAvailability(initialData);

        setMaid({
          ...initialData,
          isAvailableNow:
            initialAvailability,
        });

        setIsAvailable(
          initialAvailability,
        );

        setLoading(false);

        /* ------------------------------------------
           Maid Realtime Listener
        ------------------------------------------ */

        unsubscribeMaid = onSnapshot(
          maidRef,
          async (snapshot) => {
            if (!snapshot.exists()) {
              return;
            }

            const maidData =
              snapshot.data() as MaidData;

            const effectiveAvailability =
              calculateAvailability(
                maidData,
              );

            setMaid({
              ...maidData,
              isAvailableNow:
                effectiveAvailability,
            });

            setIsAvailable(
              effectiveAvailability,
            );

            /*
             * Keep Firestore availability
             * synchronized with actual availability.
             */

            if (
              maidData.isAvailableNow !==
              effectiveAvailability
            ) {
              try {
                await updateDoc(
                  maidRef,
                  {
                    isAvailableNow:
                      effectiveAvailability,
                  },
                );
              } catch (error) {
                console.error(
                  "AUTO AVAILABILITY UPDATE ERROR:",
                  error,
                );
              }
            }
          },
          (error) => {
            console.error(
              "MAID LISTENER ERROR:",
              error,
            );
          },
        );

        /* ------------------------------------------
           Automatic Availability Check

           Every 30 seconds
        ------------------------------------------ */

        const availabilityInterval =
          setInterval(async () => {
            try {
              const latestSnapshot =
                await getDoc(maidRef);

              if (
                !latestSnapshot.exists()
              ) {
                return;
              }

              const latestData =
                latestSnapshot.data() as MaidData;

              const effectiveAvailability =
                calculateAvailability(
                  latestData,
                );

              setMaid({
                ...latestData,
                isAvailableNow:
                  effectiveAvailability,
              });

              setIsAvailable(
                effectiveAvailability,
              );

              if (
                latestData.isAvailableNow !==
                effectiveAvailability
              ) {
                try {
                  await updateDoc(
                    maidRef,
                    {
                      isAvailableNow:
                        effectiveAvailability,
                    },
                  );
                } catch (error) {
                  console.error(
                    "AUTO AVAILABILITY UPDATE ERROR:",
                    error,
                  );
                }
              }
            } catch (error) {
              console.error(
                "AVAILABILITY CHECK ERROR:",
                error,
              );
            }
          }, 30 * 1000);

        cleanupInterval = () => {
          clearInterval(
            availabilityInterval,
          );
        };

        /* ------------------------------------------
           Booking Listener

           Only verified maids
        ------------------------------------------ */

        if (
          initialData.verificationStatus ===
          "verified"
        ) {
          const bookingsQuery = query(
            collection(db, "bookings"),
            where(
              "maidId",
              "==",
              user.uid,
            ),
          );

          unsubscribeBookings =
            onSnapshot(
              bookingsQuery,
              (snapshot) => {
                const assignedBooking =
                  snapshot.docs.find(
                    (bookingDoc) =>
                      bookingDoc.data()
                        ?.status ===
                      "assigned",
                  );

                if (!assignedBooking) {
                  return;
                }

                const bookingId =
                  assignedBooking.id;

                /*
                 * Prevent opening the same
                 * booking request repeatedly.
                 */

                if (
                  openedBookingIdRef.current ===
                  bookingId
                ) {
                  return;
                }

                openedBookingIdRef.current =
                  bookingId;

                router.push({
                  pathname:
                    "/maid/booking-request",
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
        }
      } catch (error) {
        console.error(
          "MAID HOME ERROR:",
          error,
        );

        setLoading(false);
      }
    };

    setup();

    return () => {
      unsubscribeMaid?.();
      unsubscribeBookings?.();
      cleanupInterval?.();
    };
  }, []);

  /* --------------------------------------------------
     Verification
  -------------------------------------------------- */

  const verificationStatus =
    maid?.verificationStatus ?? "pending";

  const isVerified =
    verificationStatus === "verified";

  /* --------------------------------------------------
     Availability Toggle
  -------------------------------------------------- */

  const handleAvailabilityPress =
    async () => {
      if (!isVerified) {
        return;
      }

      const user = auth.currentUser;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const maidRef = doc(
        db,
        "maids",
        user.uid,
      );

      const currentData = maid;

      if (!currentData) {
        return;
      }

      const now = new Date();

      const activeSlot =
        getActiveAvailabilitySlot(
          currentData.availabilitySlots ||
            [],
          now,
        );

      const newAvailability =
        !isAvailable;

      let availabilityOverride:
        | AvailabilityOverride
        | undefined;

      /*
       * Scheduled slot active
       */

      if (activeSlot) {
        availabilityOverride =
          newAvailability
            ? null
            : "manual_off";
      } else {
        /*
         * Outside scheduled slot
         */

        availabilityOverride =
          newAvailability
            ? "manual_on"
            : null;
      }

      /*
       * Update UI immediately
       */

      setIsAvailable(
        newAvailability,
      );

      setMaid((previous) =>
        previous
          ? {
              ...previous,
              isAvailableNow:
                newAvailability,
              availabilityOverride,
            }
          : previous,
      );

      try {
        await updateDoc(maidRef, {
          isAvailableNow:
            newAvailability,

          availabilityOverride,
        });

        console.log(
          "AVAILABILITY UPDATED:",
          newAvailability,
          "override:",
          availabilityOverride,
        );
      } catch (error) {
        console.error(
          "AVAILABILITY UPDATE ERROR:",
          error,
        );

        /*
         * Rollback UI
         */

        setIsAvailable(
          !newAvailability,
        );

        setMaid((previous) =>
          previous
            ? {
                ...previous,
                isAvailableNow:
                  !newAvailability,
              }
            : previous,
        );
      }
    };

  /* --------------------------------------------------
     Upcoming Availability
  -------------------------------------------------- */

  const handleUpcomingAvailabilityPress =
    () => {
      if (!isVerified) {
        Alert.alert(
          "Verification Required",
          "You need to be verified before setting upcoming availability.",
          [
            {
              text: "View Verification",
              onPress: () =>
                router.push(
                  "/maid/profile",
                ),
            },
            {
              text: "OK",
              style: "cancel",
            },
          ],
        );

        return;
      }

      router.push(
        "/maid/availability",
      );
    };

  /* --------------------------------------------------
     Bookings
  -------------------------------------------------- */

  const handleBookingPress = () => {
    if (!isVerified) {
      Alert.alert(
        "Verification Required",
        "You need to complete verification before you can receive bookings.",
        [
          {
            text: "View Verification",
            onPress: () =>
              router.push(
                "/maid/profile",
              ),
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

  /* --------------------------------------------------
     Navigation
  -------------------------------------------------- */

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

  /* --------------------------------------------------
     Loading
  -------------------------------------------------- */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
        edges={["top", "bottom"]}
      >
        <StatusBar
          translucent={false}
          backgroundColor="#F7F8FA"
          barStyle="dark-content"
        />

        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading your dashboard...
        </Text>
      </SafeAreaView>
    );
  }

  /* --------------------------------------------------
     UI
  -------------------------------------------------- */

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <StatusBar
        translucent={false}
        backgroundColor="#F7F8FA"
        barStyle="dark-content"
      />

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* Header */}

        <View style={styles.header}>
          <View>
            <Text style={styles.smallTitle}>
              {greeting}
            </Text>

            <Text style={styles.name}>
              {maid?.name || "Maid"}
            </Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={
              handleProfilePress
            }
          >
            <Text
              style={styles.profileIcon}
            >
              👤
            </Text>
          </Pressable>
        </View>

        {/* Verification Pending */}

        {verificationStatus ===
          "pending" && (
          <View
            style={styles.warningCard}
          >
            <View
              style={
                styles.warningIconContainer
              }
            >
              <Text
                style={styles.warningIcon}
              >
                !
              </Text>
            </View>

            <View
              style={styles.warningContent}
            >
              <Text
                style={styles.warningTitle}
              >
                Verification Pending
              </Text>

              <Text
                style={styles.warningText}
              >
                Your profile is under
                verification. You can
                explore the app, but
                bookings will be available
                after verification.
              </Text>

              <Pressable
                style={
                  styles.viewVerificationButton
                }
                onPress={
                  handleProfilePress
                }
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

        {verificationStatus ===
          "rejected" && (
          <View
            style={styles.rejectedCard}
          >
            <View
              style={
                styles.rejectedIconContainer
              }
            >
              <Text
                style={styles.rejectedIcon}
              >
                !
              </Text>
            </View>

            <View
              style={styles.warningContent}
            >
              <Text
                style={styles.rejectedTitle}
              >
                Verification Rejected
              </Text>

              <Text
                style={styles.warningText}
              >
                Your verification needs
                attention. Open your
                profile to review and
                update your details.
              </Text>

              <Pressable
                style={
                  styles.viewVerificationButton
                }
                onPress={
                  handleProfilePress
                }
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

        {verificationStatus ===
          "verified" && (
          <View
            style={styles.verifiedCard}
          >
            <View
              style={
                styles.verifiedIconContainer
              }
            >
              <Text
                style={styles.verifiedIcon}
              >
                ✓
              </Text>
            </View>

            <View
              style={styles.verifiedContent}
            >
              <Text
                style={styles.verifiedTitle}
              >
                You're Verified
              </Text>

              <Text
                style={styles.verifiedText}
              >
                Your account is ready to
                receive bookings.
              </Text>
            </View>
          </View>
        )}

        {/* Availability */}

        <View
          style={styles.sectionHeader}
        >
          <Text
            style={styles.sectionTitle}
          >
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

        {/* Available Now */}

        <Pressable
          style={[
            styles.availabilityCard,
            isAvailable &&
              styles.availabilityCardActive,
          ]}
          onPress={
            handleAvailabilityPress
          }
        >
          <View
            style={styles.availabilityLeft}
          >
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
                style={
                  styles.availabilityTitle
                }
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
            <Text
              style={styles.upcomingIcon}
            >
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
              Choose dates and time slots
              for future bookings
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </Pressable>

        {/* Bookings */}

        <View
          style={styles.sectionHeader}
        >
          <Text
            style={styles.sectionTitle}
          >
            Bookings
          </Text>
        </View>

        <Pressable
          style={[
            styles.bookingCard,
            !isVerified &&
              styles.bookingCardLocked,
          ]}
          onPress={
            handleBookingPress
          }
        >
          <View
            style={
              styles.bookingIconContainer
            }
          >
            <Text
              style={styles.bookingIcon}
            >
              📋
            </Text>
          </View>

          <View
            style={styles.bookingContent}
          >
            <Text
              style={styles.bookingTitle}
            >
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
            <View
              style={styles.lockBadge}
            >
              <Text
                style={styles.lockText}
              >
                🔒
              </Text>
            </View>
          )}
        </Pressable>

        {/* Quick Actions */}

        <View
          style={styles.sectionHeader}
        >
          <Text
            style={styles.sectionTitle}
          >
            Quick Actions
          </Text>
        </View>

        <View
          style={styles.quickActions}
        >
          <Pressable
            style={styles.quickCard}
            onPress={
              handleServicesPress
            }
          >
            <Text
              style={styles.quickIcon}
            >
              🧹
            </Text>

            <Text
              style={styles.quickTitle}
            >
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
            onPress={
              handleHistoryPress
            }
          >
            <Text
              style={styles.quickIcon}
            >
              📜
            </Text>

            <Text
              style={styles.quickTitle}
            >
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

        <View
          style={styles.sectionHeader}
        >
          <Text
            style={styles.sectionTitle}
          >
            Service Area
          </Text>
        </View>

        <View style={styles.areaCard}>
          <Text
            style={styles.locationIcon}
          >
            📍
          </Text>

          <View
            style={styles.areaContent}
          >
            <Text
              style={styles.areaTitle}
            >
              Current Service Area
            </Text>

            <Text
              style={styles.areaText}
            >
              {maid?.serviceArea ||
                "Not set"}
            </Text>
          </View>
        </View>

        {/* Profile */}

        <Pressable
          style={styles.profileCard}
          onPress={
            handleProfilePress
          }
        >
          <View
            style={
              styles.profileCardIcon
            }
          >
            <Text
              style={
                styles.profileCardEmoji
              }
            >
              👤
            </Text>
          </View>

          <View
            style={
              styles.profileCardContent
            }
          >
            <Text
              style={
                styles.profileCardTitle
              }
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
        <Pressable
          style={styles.navItem}
        >
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
          onPress={
            handleBookingPress
          }
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
          onPress={
            handleProfilePress
          }
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

/* --------------------------------------------------
   Styles
-------------------------------------------------- */

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
    paddingBottom: 125,
  },

  /* Header */

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

  /* Verification */

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

  /* Sections */

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

  /* Availability */

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

  /* Bookings */

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

  /* Quick Actions */

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

  /* Service Area */

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

  /* Profile */

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

  /* Bottom Navigation */

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 78,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: 12,
    elevation: 12,
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