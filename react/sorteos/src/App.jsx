import { useState, useEffect } from "react";
import RaffleList from "./pages/RaffleList";
import RaffleConfirm from "./pages/RaffleConfirm";
import RaffleRequirements from "./pages/RaffleRequirements";
import "./styles/globals.css";

export default function App() {
  const [screen, setScreen] = useState("list");
  const [selectedRaffle, setSelectedRaffle] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Espera a que firebase-config.js haya expuesto window.auth y window.db
    window.waitForFirebase(async (err) => {
      if (err) {
        console.error("Firebase no cargó:", err);
        window.location.href = "/inicio.html";
        return;
      }

      const unsubscribe = window.auth.onAuthStateChanged(async (firebaseUser) => {
        if (!firebaseUser) {
          // No logueado — redirige al login de tu app
          window.location.href = "/inicio.html";
          return;
        }

        try {
          // Lee el documento del usuario en Firestore
          const snap = await window.db
            .collection("users")
            .doc(firebaseUser.uid)
            .get();

          const data = snap.data() || {};

          // Suma total de pointsHistory para obtener los coins actuales
          const pointsHistory = data.pointsHistory || [];
          const totalCoins =
            typeof data.coins === "number"
              ? data.coins
              : pointsHistory.reduce((sum, entry) => sum + (entry.amount || 0), 0);

          setUser({
            uid: firebaseUser.uid,
            name:
              data.nombre ||
              data.displayName ||
              firebaseUser.displayName ||
              "Usuario",
            coins: totalCoins,
            avatar: (
              data.nombre ||
              data.displayName ||
              firebaseUser.displayName ||
              "U"
            )[0].toUpperCase(),
          });
        } catch (e) {
          console.error("Error leyendo usuario:", e);
          // Si falla la lectura igual muestra la app con datos básicos
          setUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || "Usuario",
            coins: 0,
            avatar: (firebaseUser.displayName || "U")[0].toUpperCase(),
          });
        } finally {
          setLoading(false);
        }
      });

      return () => unsubscribe();
    });
  }, []);

  const handleSelectRaffle = (raffle) => {
    setSelectedRaffle(raffle);
    setScreen("confirm");
  };

  const handleConfirmParticipation = (updatedCoins) => {
    // Actualiza los coins en el estado local después de pagar
    if (typeof updatedCoins === "number") {
      setUser((prev) => ({ ...prev, coins: updatedCoins }));
    }
    setScreen("requirements");
  };

  const handleBack = () => {
    if (screen === "confirm") setScreen("list");
    if (screen === "requirements") setScreen("confirm");
  };

  if (loading) {
    return (
      <div className="app-root app-loading">
        <div className="app-loading__spinner" />
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="app-root">
      {screen === "list" && (
        <RaffleList user={user} onSelect={handleSelectRaffle} />
      )}
      {screen === "confirm" && selectedRaffle && (
        <RaffleConfirm
          raffle={selectedRaffle}
          user={user}
          onConfirm={handleConfirmParticipation}
          onBack={handleBack}
        />
      )}
      {screen === "requirements" && selectedRaffle && (
        <RaffleRequirements raffle={selectedRaffle} onBack={handleBack} />
      )}
    </div>
  );
}
