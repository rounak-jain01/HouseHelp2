import notifee, {
  AndroidImportance,
} from "react-native-notify-kit";

import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  onMessage,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";

import {
  arrayUnion,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
} from "@react-native-firebase/firestore";

// ============================================================
// FIREBASE
// ============================================================

const db = getFirestore();
const messaging = getMessaging();

// ============================================================
// TYPES
// ============================================================

export type NotificationRole =
  | "customer"
  | "maid";

export type AppNotification = {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  bookingId?: string;
  isRead?: boolean;
  createdAt?: any;
};

// ============================================================
// NOTIFICATION CHANNEL
// Android notification channel
// ============================================================

export const createNotificationChannel =
  async (): Promise<string> => {
    try {
      const channelId =
        await notifee.createChannel({
          id: "househelp_notifications",
          name: "HouseHelp Notifications",
          importance: AndroidImportance.HIGH,
        });

      console.log(
        "NOTIFICATION CHANNEL READY:",
        channelId,
      );

      return channelId;
    } catch (error) {
      console.error(
        "NOTIFICATION CHANNEL ERROR:",
        error,
      );

      return "househelp_notifications";
    }
  };

// ============================================================
// REQUEST NOTIFICATION PERMISSION
// ============================================================

export const requestNotificationPermission =
  async (): Promise<boolean> => {
    try {
      const authStatus =
        await requestPermission(
          messaging,
        );

      const enabled =
        authStatus ===
          AuthorizationStatus.AUTHORIZED ||
        authStatus ===
          AuthorizationStatus.PROVISIONAL;

      console.log(
        "NOTIFICATION PERMISSION:",
        enabled
          ? "granted"
          : "denied",
      );

      return enabled;
    } catch (error) {
      console.error(
        "NOTIFICATION PERMISSION ERROR:",
        error,
      );

      return false;
    }
  };

// ============================================================
// REGISTER CURRENT FCM TOKEN
// ============================================================

export const registerFCMToken =
  async (
    userId: string,
    role: NotificationRole,
  ): Promise<string | null> => {
    try {
      const permissionGranted =
        await requestNotificationPermission();

      if (!permissionGranted) {
        console.log(
          "Notification permission not granted.",
        );

        return null;
      }

      const token =
        await getToken(messaging);

      if (!token) {
        console.log(
          "FCM token not available.",
        );

        return null;
      }

      console.log(
        "FCM TOKEN:",
        token,
      );

      const collectionName =
        role === "customer"
          ? "users"
          : "maids";

      const userRef = doc(
        db,
        collectionName,
        userId,
      );

      await updateDoc(
        userRef,
        {
          fcmTokens:
            arrayUnion(token),
        },
      );

      console.log(
        `FCM token saved for ${role}:`,
        userId,
      );

      return token;
    } catch (error) {
      console.error(
        "FCM TOKEN REGISTRATION ERROR:",
        error,
      );

      return null;
    }
  };

// ============================================================
// LISTEN FOR FCM TOKEN REFRESH
// ============================================================

export const listenForTokenRefresh = (
  userId: string,
  role: NotificationRole,
) => {
  const collectionName =
    role === "customer"
      ? "users"
      : "maids";

  return onTokenRefresh(
    messaging,
    async (newToken) => {
      try {
        console.log(
          "FCM TOKEN REFRESHED:",
          newToken,
        );

        const userRef = doc(
          db,
          collectionName,
          userId,
        );

        await updateDoc(
          userRef,
          {
            fcmTokens:
              arrayUnion(newToken),
          },
        );

        console.log(
          `New FCM token saved for ${role}:`,
          userId,
        );
      } catch (error) {
        console.error(
          "FCM TOKEN REFRESH SAVE ERROR:",
          error,
        );
      }
    },
  );
};

// ============================================================
// FOREGROUND PUSH NOTIFICATION
//
// FCM onMessage is triggered when app is open/foreground.
// We use Notifee to show the Android notification.
// ============================================================

export const listenForForegroundPush =
  () => {
    return onMessage(
      messaging,
      async (remoteMessage) => {
        try {
          console.log(
            "FOREGROUND FCM MESSAGE:",
            remoteMessage,
          );

          const title =
            remoteMessage.notification
              ?.title ||
            "HouseHelp";

          const body =
            remoteMessage.notification
              ?.body ||
            "You have a new notification.";

          const bookingId =
            remoteMessage.data
              ?.bookingId || "";

          const type =
            remoteMessage.data
              ?.type || "";

          const channelId =
            await createNotificationChannel();

          await notifee.displayNotification(
            {
              title,
              body,

              data: {
                bookingId,
                type,
              },

              android: {
                channelId,

                importance:
                  AndroidImportance.HIGH,

                pressAction: {
                  id: "default",
                },
              },
            },
          );

          console.log(
            "FOREGROUND PUSH DISPLAYED",
          );
        } catch (error) {
          console.error(
            "FOREGROUND PUSH ERROR:",
            error,
          );
        }
      },
    );
  };

// ============================================================
// LISTEN FOR USER NOTIFICATIONS
//
// Customer:
// users/{userId}/notifications
//
// Maid:
// maids/{maidId}/notifications
// ============================================================

export const listenForNotifications = (
  userId: string,
  role: NotificationRole,
  callback: (
    notifications: AppNotification[],
  ) => void,
) => {
  const collectionName =
    role === "customer"
      ? "users"
      : "maids";

  const notificationsRef =
    collection(
      db,
      collectionName,
      userId,
      "notifications",
    );

  const notificationsQuery =
    query(
      notificationsRef,
      orderBy(
        "createdAt",
        "desc",
      ),
    );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications =
        snapshot.docs.map(
          (notificationDoc) => ({
            id: notificationDoc.id,

            ...(notificationDoc.data() as Omit<
              AppNotification,
              "id"
            >),
          }),
        );

      callback(notifications);
    },

    (error) => {
      console.error(
        "NOTIFICATION LISTENER ERROR:",
        error,
      );

      callback([]);
    },
  );
};

// ============================================================
// MARK NOTIFICATION AS READ
// ============================================================

export const markNotificationAsRead =
  async (
    userId: string,
    role: NotificationRole,
    notificationId: string,
  ) => {
    try {
      const collectionName =
        role === "customer"
          ? "users"
          : "maids";

      const notificationRef =
        doc(
          db,
          collectionName,
          userId,
          "notifications",
          notificationId,
        );

      await updateDoc(
        notificationRef,
        {
          isRead: true,
        },
      );
    } catch (error) {
      console.error(
        "MARK NOTIFICATION READ ERROR:",
        error,
      );
    }
  };

// ============================================================
// DELETE NOTIFICATION
// ============================================================

export const deleteNotification =
  async (
    userId: string,
    role: NotificationRole,
    notificationId: string,
  ) => {
    try {
      const collectionName =
        role === "customer"
          ? "users"
          : "maids";

      const notificationRef =
        doc(
          db,
          collectionName,
          userId,
          "notifications",
          notificationId,
        );

      await deleteDoc(
        notificationRef,
      );
    } catch (error) {
      console.error(
        "DELETE NOTIFICATION ERROR:",
        error,
      );
    }
  };