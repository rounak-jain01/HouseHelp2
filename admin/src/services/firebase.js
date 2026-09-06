import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD28L_7oEn0QhoqRrqbD_P1rqD98vVJG3g",
  authDomain: "househelp-88105.firebaseapp.com",
  projectId: "househelp-88105",
  storageBucket: "househelp-88105.firebasestorage.app",
  messagingSenderId: "993806474795",
  appId: "1:993806474795:web:9478cac086580fba88546e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;