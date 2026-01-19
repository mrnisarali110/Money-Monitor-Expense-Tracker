
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

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
const app = firebase.initializeApp(firebaseConfig);
export const auth = app.auth();
export const db = app.firestore();

// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
      console.warn('Persistence failed: Browser not supported');
    }
  });

export default app;
