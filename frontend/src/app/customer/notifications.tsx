import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  router,
} from "expo-router";

import {
  getAuth,
} from "@react-native-firebase/auth";

import {
  AppNotification,
  listenForNotifications,
  markNotificationAsRead,
  deleteNotification,
} from "@/services/notifications";


// ============================================================
// FIREBASE
// ============================================================

const auth = getAuth();


// ============================================================
// HELPERS
// ============================================================

const formatNotificationTime = (
  createdAt: any,
) => {
  if (!createdAt) {
    return "";
  }

  try {
    const date =
      createdAt.toDate
        ? createdAt.toDate()
        : new Date(createdAt);

    const now = new Date();

    const difference =
      now.getTime() -
      date.getTime();

    const minutes = Math.floor(
      difference / 60000,
    );

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(
      minutes / 60,
    );

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(
      hours / 24,
    );

    if (days < 7) {
      return `${days}d ago`;
    }

    return date.toLocaleDateString();

  } catch {
    return "";
  }
};


const getNotificationIcon = (
  type?: string,
) => {
  switch (type) {
    case "booking_assigned":
      return "📋";

    case "booking_confirmed":
      return "✓";

    case "booking_started":
      return "▶";

    case "booking_completed":
      return "✓";

    case "booking_cancelled":
      return "✕";

    case "no_maid_found":
      return "⚠";

    default:
      return "🔔";
  }
};


// ============================================================
// SCREEN
// ============================================================

export default function CustomerNotifications() {
  const [notifications, setNotifications] =
    useState<AppNotification[]>([]);

  const [loading, setLoading] =
    useState(true);


  // ==========================================================
  // REALTIME NOTIFICATION LISTENER
  // ==========================================================

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      router.replace(
        "/auth/login",
      );

      return;
    }

    const unsubscribe =
      listenForNotifications(
        user.uid,
        "customer",
        (items) => {
          setNotifications(items);
          setLoading(false);
        },
      );

    return unsubscribe;

  }, []);


  // ==========================================================
  // OPEN NOTIFICATION
  // ==========================================================

  const handleNotificationPress =
    async (
      notification: AppNotification,
    ) => {
      const user =
        auth.currentUser;

      if (!user) {
        return;
      }

      if (!notification.isRead) {
        await markNotificationAsRead(
          user.uid,
          "customer",
          notification.id,
        );
      }

      if (notification.bookingId) {
        router.push({
          pathname:
            "/customer/waiting",
          params: {
            bookingId:
              notification.bookingId,
          },
        });
      }
    };


  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete =
    async (
      notificationId: string,
    ) => {
      const user =
        auth.currentUser;

      if (!user) {
        return;
      }

      await deleteNotification(
        user.uid,
        "customer",
        notificationId,
      );
    };


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
        edges={[
          "top",
          "bottom",
        ]}
      >
        <StatusBar
          translucent={false}
          backgroundColor="#F7F8FA"
          barStyle="dark-content"
        />

        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading notifications...
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <SafeAreaView
      style={
        styles.container
      }
      edges={[
        "top",
        "bottom",
      ]}
    >
      <StatusBar
        translucent={false}
        backgroundColor="#F7F8FA"
        barStyle="dark-content"
      />


      {/* ====================================================
          HEADER
      ==================================================== */}

      <View
        style={styles.header}
      >
        <Pressable
          style={
            styles.backButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backIcon
            }
          >
            ‹
          </Text>
        </Pressable>


        <Text
          style={styles.headerTitle}
        >
          Notifications
        </Text>


        <View
          style={
            styles.headerSpacer
          }
        />
      </View>


      {/* ====================================================
          CONTENT
      ==================================================== */}

      <ScrollView
        style={
          styles.scrollView
        }
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {notifications.length ===
        0 ? (
          <View
            style={
              styles.emptyContainer
            }
          >
            <View
              style={
                styles.emptyIconContainer
              }
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                🔔
              </Text>
            </View>


            <Text
              style={
                styles.emptyTitle
              }
            >
              No notifications
            </Text>


            <Text
              style={
                styles.emptyText
              }
            >
              You're all caught up.
              New updates will appear
              here.
            </Text>
          </View>
        ) : (
          notifications.map(
            (notification) => (
              <Pressable
                key={
                  notification.id
                }
                style={[
                  styles.notificationCard,
                  !notification.isRead &&
                    styles.unreadCard,
                ]}
                onPress={() =>
                  handleNotificationPress(
                    notification,
                  )
                }
              >

                {/* ICON */}

                <View
                  style={[
                    styles.iconContainer,
                    !notification.isRead &&
                      styles.unreadIconContainer,
                  ]}
                >
                  <Text
                    style={
                      styles.notificationIcon
                    }
                  >
                    {getNotificationIcon(
                      notification.type,
                    )}
                  </Text>
                </View>


                {/* CONTENT */}

                <View
                  style={
                    styles.notificationContent
                  }
                >
                  <View
                    style={
                      styles.titleRow
                    }
                  >
                    <Text
                      style={
                        styles.notificationTitle
                      }
                      numberOfLines={1}
                    >
                      {notification.title ||
                        "Notification"}
                    </Text>

                    {!notification.isRead && (
                      <View
                        style={
                          styles.unreadDot
                        }
                      />
                    )}
                  </View>


                  <Text
                    style={
                      styles.notificationBody
                    }
                  >
                    {notification.body ||
                      ""}
                  </Text>


                  <Text
                    style={
                      styles.notificationTime
                    }
                  >
                    {formatNotificationTime(
                      notification.createdAt,
                    )}
                  </Text>
                </View>


                {/* DELETE */}

                <Pressable
                  style={
                    styles.deleteButton
                  }
                  onPress={(event) => {
                    event.stopPropagation();

                    handleDelete(
                      notification.id,
                    );
                  }}
                >
                  <Text
                    style={
                      styles.deleteText
                    }
                  >
                    ×
                  </Text>
                </Pressable>

              </Pressable>
            ),
          )
        )}

        {/* Bottom safe spacing */}

        <View
          style={
            styles.bottomSpacing
          }
        />

      </ScrollView>
    </SafeAreaView>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  // ----------------------------------------------------------
  // MAIN
  // ----------------------------------------------------------

  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },


  // ----------------------------------------------------------
  // LOADING
  // ----------------------------------------------------------

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },


  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },


  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------

  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 20,

    backgroundColor: "#F7F8FA",

    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },


  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFFFFF",
  },


  backIcon: {
    fontSize: 32,
    lineHeight: 34,
    color: "#111827",
  },


  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111827",
  },


  headerSpacer: {
    width: 42,
  },


  // ----------------------------------------------------------
  // CONTENT
  // ----------------------------------------------------------

  scrollView: {
    flex: 1,
  },


  content: {
    paddingHorizontal: 20,

    // Space below header
    paddingTop: 18,

    // Space above Android navigation area
    paddingBottom: 30,
  },


  // ----------------------------------------------------------
  // NOTIFICATION CARD
  // ----------------------------------------------------------

  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",

    backgroundColor: "#FFFFFF",

    borderRadius: 18,

    padding: 15,

    marginBottom: 12,

    elevation: 1,
  },


  unreadCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },


  // ----------------------------------------------------------
  // ICON
  // ----------------------------------------------------------

  iconContainer: {
    width: 46,
    height: 46,

    borderRadius: 14,

    backgroundColor: "#F3F4F6",

    alignItems: "center",
    justifyContent: "center",

    marginRight: 12,
  },


  unreadIconContainer: {
    backgroundColor: "#EEF2FF",
  },


  notificationIcon: {
    fontSize: 20,
  },


  // ----------------------------------------------------------
  // CONTENT
  // ----------------------------------------------------------

  notificationContent: {
    flex: 1,

    paddingRight: 5,
  },


  titleRow: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 5,
  },


  notificationTitle: {
    flex: 1,

    fontSize: 14,
    fontWeight: "700",

    color: "#111827",
  },


  unreadDot: {
    width: 8,
    height: 8,

    borderRadius: 4,

    backgroundColor: "#111827",

    marginLeft: 8,
  },


  notificationBody: {
    fontSize: 12,
    lineHeight: 18,

    color: "#6B7280",
  },


  notificationTime: {
    marginTop: 7,

    fontSize: 10,

    color: "#9CA3AF",
  },


  // ----------------------------------------------------------
  // DELETE
  // ----------------------------------------------------------

  deleteButton: {
    width: 28,
    height: 28,

    alignItems: "center",
    justifyContent: "center",
  },


  deleteText: {
    fontSize: 22,
    color: "#9CA3AF",
  },


  // ----------------------------------------------------------
  // EMPTY
  // ----------------------------------------------------------

  emptyContainer: {
    alignItems: "center",

    justifyContent: "center",

    paddingTop: 100,

    paddingHorizontal: 30,
  },


  emptyIconContainer: {
    width: 76,
    height: 76,

    borderRadius: 38,

    backgroundColor: "#FFFFFF",

    alignItems: "center",
    justifyContent: "center",

    marginBottom: 18,
  },


  emptyIcon: {
    fontSize: 32,
  },


  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",

    color: "#111827",

    marginBottom: 7,
  },


  emptyText: {
    fontSize: 13,
    lineHeight: 19,

    color: "#6B7280",

    textAlign: "center",
  },


  // ----------------------------------------------------------
  // BOTTOM SAFE SPACE
  // ----------------------------------------------------------

  bottomSpacing: {
    height: 25,
  },

});