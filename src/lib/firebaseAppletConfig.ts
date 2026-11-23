export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  [key: string]: any;
}

export const firebaseConfig: FirebaseAppletConfig = {
  projectId: "tejascanavssingstore",
  appId: "1:1063501578322:web:03bec37f537e6303ad9f8b",
  apiKey: "AIzaSyCrSNFnMxwSFIMQamZaNmwy1yWVqBU42l4",
  authDomain: "tejascanavssingstore.firebaseapp.com",
  firestoreDatabaseId: "(default)",
  storageBucket: "tejascanavssingstore.firebasestorage.app",
  messagingSenderId: "1063501578322",
  measurementId: "G-DZFNV0HYN5"
};

export default firebaseConfig;
