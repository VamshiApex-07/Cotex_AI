// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "cortex-ai-7ba05.firebaseapp.com",
  projectId: "cortex-ai-7ba05",
  storageBucket: "cortex-ai-7ba05.firebasestorage.app",
  messagingSenderId: "1085576178105",
  appId: "1:1085576178105:web:b94933f33662ba86eaae68",
  measurementId: "G-P8F5HDQER5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth=getAuth(app)
export const googleProvider=new GoogleAuthProvider()

// Forces the account chooser on every sign-in. Without it, Google silently
// reuses the last account, so "Use a different account" on the auth page would
// clear the remembered profile and then log straight back into the same one.
googleProvider.setCustomParameters({ prompt: "select_account" })