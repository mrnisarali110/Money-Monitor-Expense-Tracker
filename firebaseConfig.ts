
import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDI4Y_Vq9HD5a0TcXc5xiLhXs_2jzAEJl0",
  authDomain: "money-manager-e46e4.firebaseapp.com",
  projectId: "money-manager-e46e4",
  storageBucket: "money-manager-e46e4.firebasestorage.app",
  messagingSenderId: "695163284562",
  appId: "1:695163284562:web:d09eb8c3739f1aceb4c38b"
};

// Initialize Firebase
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
export const auth = app.auth();
export const db = app.firestore();
export default app;
