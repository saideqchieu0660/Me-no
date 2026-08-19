import { initializeApp } from "firebase/app";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";

try {
  const firebaseConfig = {
    apiKey: "DUMMY_KEY_FOR_INIT",
    authDomain: "dummy-domain",
    projectId: "dummy-project",
    storageBucket: "dummy-bucket",
    messagingSenderId: "dummy-sender",
    appId: "dummy-app-id"
  };
  const app = initializeApp(firebaseConfig);
  console.log("App init ok");
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  console.log("Firestore init ok");
} catch(e) {
  console.error("Firebase crashed:", e);
}
