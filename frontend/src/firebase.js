import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBnPIkNFhzWj_XEMKJgIciIpvG92o7H4aU",
  authDomain: "rescueos-9f363.firebaseapp.com",
  projectId: "rescueos-9f363",
  storageBucket: "rescueos-9f363.firebasestorage.app",
  messagingSenderId: "315399778431",
  appId: "1:315399778431:web:d572a8e047d465e44acf4a",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);