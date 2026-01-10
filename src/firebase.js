// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, sendEmailVerification } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDgbBshRVDCM-j31eFvZOLGkn8uX18O3cY",
  authDomain: "medtry-96b07.firebaseapp.com",
  projectId: "medtry-96b07",
  storageBucket: "medtry-96b07.appspot.com",
  messagingSenderId: "412287546354",
  appId: "1:412287546354:web:ce0d614e08f4f85cd1316b",
  measurementId: "G-46PKKWDN1T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { auth, storage, sendEmailVerification };
export default app;
