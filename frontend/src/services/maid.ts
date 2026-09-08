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
  profilePhotoUri,
  idProofUri,
}: {
  name: string;
  phoneNumber: string;
  serviceCategories: string[];
  serviceArea: string;
  profilePhotoUri: string;
  idProofUri: string;
}) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User session not found. Please login again.");
  }

  const uid = user.uid;

  // -----------------------------
  // Upload Profile Photo
  // -----------------------------

  const profilePhotoRef = ref(
    storage,
    `maid-profile-photos/${uid}/profile-photo.jpg`
  );

  await putFile(profilePhotoRef, profilePhotoUri);

  const profilePhotoUrl =
    await getDownloadURL(profilePhotoRef);

  // -----------------------------
  // Upload ID Proof
  // -----------------------------

  const idProofFileName =
    `id-proof-${Date.now()}.jpg`;

  const idProofRef = ref(
    storage,
    `maid-id-proofs/${uid}/${idProofFileName}`
  );

  await putFile(idProofRef, idProofUri);

  const idProofUrl =
    await getDownloadURL(idProofRef);

  // -----------------------------
  // Create Maid Profile
  // -----------------------------

  await setDoc(doc(db, "maids", uid), {
    maidId: uid,
    role: "maid",
    phoneNumber,
    name,

    photoUrl: profilePhotoUrl,
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
    profilePhotoUrl,
    idProofUrl,
  };
};