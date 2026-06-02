/* ============================================================ */
/* DELETE USER DATA                                             */
/* Borra cuenta y datos asociados mediante Cloud Functions.     */
/* ============================================================ */

async function deleteUserData(uid) {
  if (!uid) throw new Error('deleteUserData: uid es requerido');
  if (!firebase?.functions) throw new Error('Firebase Functions no esta disponible');

  vgLog(`[deleteUserData] Solicitando eliminacion server-side para uid: ${uid}`);
  const fn = firebase.functions().httpsCallable('deleteOwnAccount');
  await fn();
  vgLog(`[deleteUserData] Eliminacion server-side completada para uid: ${uid}`);
}
