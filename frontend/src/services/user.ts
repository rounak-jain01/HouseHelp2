import {
  getFirestore,
  doc,
  setDoc,
} from "@react-native-firebase/firestore";

const db = getFirestore();

export const createCustomerProfile = async ({
  uid,
  phoneNumber,
  name,
  formattedAddress,
  latitude,
  longitude,
  landmark,
}: {
  uid: string;
  phoneNumber: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  landmark?: string;
}) => {
  await setDoc(doc(db, "users", uid), {
    userId: uid,
    role: "customer",
    phoneNumber,
    name,
    address: {
      formattedAddress,
      latitude,
      longitude,
      landmark: landmark?.trim() || null,
    },
    createdAt: new Date(),
  });
};