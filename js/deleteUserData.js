/* ============================================================ */
/* DELETE USER DATA                                             */
/* Limpia TODOS los datos del usuario en Firestore y Storage   */
/* Llamar ANTES de user.delete()                               */
/* ============================================================ */

/**
 * Elimina todos los documentos de Firestore donde uid == uid dado.
 * Colecciones que usan uid del usuario como campo o como ID de doc.
 */
async function deleteUserFirestoreData(uid) {
  const db = window.db;

  // Colecciones donde el documento tiene el uid como ID directo
  const directDocs = [
    db.collection('users').doc(uid)
  ];

  // Colecciones donde los documentos tienen un campo uid o userId == uid
  const queryCollections = [
    { col: 'notifications',      field: 'userId' },
    { col: 'pointsHistory',      field: 'userId' },
    { col: 'raffleParticipants', field: 'userId' },
    { col: 'redeemRequests',     field: 'userId' },
    { col: 'activities',         field: 'userId' },
    { col: 'user_rewards',       field: 'userId' },
    { col: 'ayetTransactions',   field: 'userId' },
    { col: 'adgemTransactions',  field: 'userId' },
    // Fallback: también buscar por campo 'uid' en las mismas colecciones
    { col: 'notifications',      field: 'uid' },
    { col: 'pointsHistory',      field: 'uid' },
    { col: 'raffleParticipants', field: 'uid' },
    { col: 'redeemRequests',     field: 'uid' },
    { col: 'activities',         field: 'uid' },
    { col: 'user_rewards',       field: 'uid' },
    { col: 'ayetTransactions',   field: 'uid' },
    { col: 'adgemTransactions',  field: 'uid' }
  ];

  const MAX_BATCH = 450; // Firestore batch limit es 500, dejamos margen
  let batch = db.batch();
  let batchCount = 0;

  async function commitIfNeeded() {
    if (batchCount >= MAX_BATCH) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Agregar docs directos al batch
  for (const ref of directDocs) {
    try {
      const snap = await ref.get();
      if (snap.exists) {
        batch.delete(ref);
        batchCount++;
        await commitIfNeeded();
      }
    } catch (e) {
      console.warn(`[deleteUserData] Error leyendo doc directo ${ref.path}:`, e.message);
    }
  }

  // Buscar y agregar docs por query al batch (deduplicar por ruta)
  const deletedPaths = new Set();

  for (const { col, field } of queryCollections) {
    try {
      const snap = await db.collection(col).where(field, '==', uid).get();
      for (const doc of snap.docs) {
        if (deletedPaths.has(doc.ref.path)) continue;
        deletedPaths.add(doc.ref.path);
        batch.delete(doc.ref);
        batchCount++;
        await commitIfNeeded();
      }
    } catch (e) {
      // Si la colección no existe o no tiene el campo, ignorar
      console.warn(`[deleteUserData] Colección ${col}[${field}] no accesible:`, e.message);
    }
  }

  // Commit final
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`[deleteUserData] Firestore limpio para uid: ${uid} (${deletedPaths.size + directDocs.length} docs)`);
}

/**
 * Elimina todos los archivos de Storage del usuario.
 * Rutas conocidas: avatars/{uid}.jpg
 */
async function deleteUserStorageData(uid) {
  if (!window.storage) {
    console.warn('[deleteUserData] Storage no disponible, omitiendo limpieza de Storage');
    return;
  }

  const paths = [
    `avatars/${uid}.jpg`,
    `avatars/${uid}.png`,
    `avatars/${uid}.webp`,
    `users/${uid}/avatar.jpg`,
    `users/${uid}/avatar.png`
  ];

  for (const path of paths) {
    try {
      const ref = window.storage.ref().child(path);
      await ref.delete();
      console.log(`[deleteUserData] Storage eliminado: ${path}`);
    } catch (e) {
      // object-not-found es normal si el archivo no existe
      if (e.code !== 'storage/object-not-found') {
        console.warn(`[deleteUserData] No se pudo borrar ${path}:`, e.message);
      }
    }
  }
}

/**
 * Función principal — llama esta ANTES de user.delete()
 * @param {string} uid — UID del usuario a eliminar
 * @returns {Promise<void>}
 */
async function deleteUserData(uid) {
  if (!uid) throw new Error('deleteUserData: uid es requerido');

  console.log(`[deleteUserData] Iniciando limpieza para uid: ${uid}`);

  await Promise.allSettled([
    deleteUserFirestoreData(uid),
    deleteUserStorageData(uid)
  ]);

  console.log(`[deleteUserData] Limpieza completa para uid: ${uid}`);
}
