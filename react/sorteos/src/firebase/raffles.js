// src/firebase/raffles.js
// Firebase Firestore integration — replace config values with your project's

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  increment,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const auth = getAuth(app);

export async function getActiveRaffles() {
  const q = query(collection(db, "raffles"), where("active", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function hasUserEntered(raffleId, userId) {
  const q = query(
    collection(db, "raffleParticipants"),
    where("raffleId", "==", raffleId),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function enterRaffle(raffleId, userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User not found");

  const userData = userSnap.data();
  const raffleRef = doc(db, "raffles", raffleId);
  const raffleSnap = await getDoc(raffleRef);
  if (!raffleSnap.exists()) throw new Error("Raffle not found");

  const raffle = raffleSnap.data();
  if (userData.coins < raffle.cost) throw new Error("Insufficient coins");

  const alreadyIn = await hasUserEntered(raffleId, userId);
  if (alreadyIn) throw new Error("Already entered this raffle");

  await updateDoc(userRef, { coins: increment(-raffle.cost) });
  await updateDoc(raffleRef, { participants: increment(1) });
  await addDoc(collection(db, "raffleParticipants"), {
    raffleId,
    userId,
    enteredAt: serverTimestamp(),
    requirementsCompleted: false,
  });

  return { success: true };
}

export async function completeRequirements(raffleId, userId) {
  const q = query(
    collection(db, "raffleParticipants"),
    where("raffleId", "==", raffleId),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { requirementsCompleted: true });
  }
}
