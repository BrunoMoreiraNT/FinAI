
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBvM2kjc7KoOBvlXB3QU0mnVePZiFYxM1k",
  authDomain: "projeto---finai-d481f.firebaseapp.com",
  projectId: "projeto---finai-d481f",
  storageBucket: "projeto---finai-d481f.firebasestorage.app",
  messagingSenderId: "103415650486",
  appId: "1:103415650486:web:702471b5d9bdaffe192e17"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
