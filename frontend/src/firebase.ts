import { initializeApp } from "firebase/app";
import { getAuth, onIdTokenChanged } from "firebase/auth";
const firebaseConfig = {
    apiKey: "AIzaSyDG12q4_zQpPCJDDVFXJX1k1njLZhZYBYQ",
    authDomain: "worksphere-efbd5.firebaseapp.com",
    projectId: "worksphere-efbd5",
    storageBucket: "worksphere-efbd5.firebasestorage.app",
    messagingSenderId: "315613621311",
    appId: "1:315613621311:web:d148ffe330d0628fa99c8a",
    
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);


export const authReady = new Promise<void>((resolve) => {
  onIdTokenChanged(auth, async (user) => {
    if (user) {
      try {
        localStorage.setItem("token", await user.getIdToken());
      } catch {
      
      }
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    resolve();
  });
});