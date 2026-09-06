import { setGlobalOptions } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
} from "firebase-admin/firestore";

initializeApp();

setGlobalOptions({
  maxInstances: 10,
});

type Booking = {
  customerId: string;
  maidId?: string | null;
  categories: string[];
  duration: number;
  scheduledDateTime: FirebaseFirestore.Timestamp;
  status: string;
};

type Maid = {
  maidId: string;
  name?: string;
  verificationStatus?: string;
  serviceCategories?: string[];
  isAvailableNow?: boolean;
  lastAssignedAt?: FirebaseFirestore.Timestamp | null;
};

const normalize = (value: string) => {
  return value.trim().toLowerCase();
};

export const assignMaid = onDocumentCreated(
  "bookings/{bookingId}",
  async (event) => {
    const bookingId = event.params.bookingId;

    const booking = event.data?.data() as Booking | undefined;

    if (!booking) {
      console.log("No booking data found.");
      return;
    }

    console.log("=================================");
    console.log("NEW BOOKING:", bookingId);
    console.log("Booking categories:", booking.categories);
    console.log("=================================");

    const db = getFirestore();

    // Get all maids.
    const maidsSnapshot = await db
      .collection("maids")
      .get();

    if (maidsSnapshot.empty) {
      console.log("No maids found.");

      await db.collection("bookings").doc(bookingId).update({
        status: "no_maid_found",
      });

      return;
    }

    const eligibleMaids: Maid[] = [];

    maidsSnapshot.forEach((maidDoc) => {
      const maid = {
        maidId: maidDoc.id,
        ...maidDoc.data(),
      } as Maid;

      const verified =
        maid.verificationStatus === "verified";

      const available =
        maid.isAvailableNow === true;

      const maidCategories =
        maid.serviceCategories || [];

      const categoryMatch =
        (booking.categories || []).every(
          (bookingCategory) =>
            maidCategories.some(
              (maidCategory) =>
                normalize(maidCategory) ===
                normalize(bookingCategory)
            )
        );

      console.log("MAID CHECK:", {
        maidId: maid.maidId,
        name: maid.name,
        verified,
        available,
        maidCategories,
        bookingCategories: booking.categories,
        categoryMatch,
      });

      if (
        verified &&
        available &&
        categoryMatch
      ) {
        eligibleMaids.push(maid);
      }
    });

    if (eligibleMaids.length === 0) {
      console.log("NO ELIGIBLE MAID FOUND");

      await db.collection("bookings").doc(bookingId).update({
        status: "no_maid_found",
      });

      return;
    }

    // Least recently assigned maid gets priority.
    eligibleMaids.sort((a, b) => {
      const aTime =
        a.lastAssignedAt?.toMillis() ?? 0;

      const bTime =
        b.lastAssignedAt?.toMillis() ?? 0;

      return aTime - bTime;
    });

    const selectedMaid = eligibleMaids[0];

    console.log(
      "SELECTED MAID:",
      selectedMaid.maidId,
      selectedMaid.name
    );

    const bookingRef =
      db.collection("bookings").doc(bookingId);

    const maidRef =
      db.collection("maids").doc(selectedMaid.maidId);

    await db.runTransaction(async (transaction) => {
      const bookingSnapshot =
        await transaction.get(bookingRef);

      if (!bookingSnapshot.exists) {
        throw new Error(
          "Booking no longer exists."
        );
      }

      const currentBooking =
        bookingSnapshot.data();

      if (
        currentBooking?.status !== "pending"
      ) {
        console.log(
          "Booking is no longer pending."
        );
        return;
      }

      transaction.update(bookingRef, {
        maidId: selectedMaid.maidId,
        status: "assigned",
        assignedAt:
          FieldValue.serverTimestamp(),
      });

      transaction.update(maidRef, {
        lastAssignedAt:
          FieldValue.serverTimestamp(),
      });
    });

    console.log(
      "BOOKING ASSIGNED SUCCESSFULLY:",
      bookingId,
      "→",
      selectedMaid.maidId
    );
  }
);