import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
} from "@react-native-firebase/firestore";
import {
  getStorage,
  ref,
  putFile,
  getDownloadURL,
} from "@react-native-firebase/storage";

const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

export const createMaidProfile = async ({
  name,
  phoneNumber,
  serviceCategories,
  serviceArea,
  idProofUri,
}: {
  name: string;
  phoneNumber: string;
  serviceCategories: string[];
  serviceArea: string;
  idProofUri: string;
}) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User session not found. Please login again.");
  }

  const uid = user.uid;

  const fileName = `id-proof-${Date.now()}.jpg`;

  const storageRef = ref(
    storage,
    `maid-id-proofs/${uid}/${fileName}`
  );

  await putFile(storageRef, idProofUri);

  const idProofUrl = await getDownloadURL(storageRef);

  await setDoc(doc(db, "maids", uid), {
    maidId: uid,
    role: "maid",
    phoneNumber,
    name,
    idProofUrl,
    verificationStatus: "pending",
    serviceCategories,
    serviceArea,
    isAvailableNow: false,
    availabilitySlots: [],
    lastAssignedAt: null,
    createdAt: new Date(),
  });

  return {
    uid,
    idProofUrl,
  };
};