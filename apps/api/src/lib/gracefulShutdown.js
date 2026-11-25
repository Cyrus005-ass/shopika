function installGracefulShutdown(server, { onClose, drainDelayMs = 0 } = {}) {
  let shuttingDown = false;
  let drainTimer;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[ARRÊT] ${signal} reçu, arrêt en cours...`);

    if (drainDelayMs > 0) {
      drainTimer = setTimeout(() => {
        console.warn('[ARRÊT] Délai de drainage dépassé, fermeture des connexions restantes.');
        server.closeAllConnections?.();
      }, drainDelayMs);
      drainTimer.unref();
    }

    server.close(async (error) => {
      if (drainTimer) clearTimeout(drainTimer);
      if (error) {
        console.error('[ARRÊT] Échec de fermeture du serveur :', error);
        process.exitCode = 1;
      }

      try {
        if (onClose) await onClose();
        console.log('[ARRÊT] Serveur arrêté proprement.');
      } catch (closeError) {
        console.error('[ARRÊT] Échec du nettoyage :', closeError);
        process.exitCode = 1;
      }
    });
  }

  const handleSigint = () => shutdown('SIGINT');
  const handleSigterm = () => shutdown('SIGTERM');
  process.on('SIGINT', handleSigint);
  process.on('SIGTERM', handleSigterm);

  return () => {
    process.off('SIGINT', handleSigint);
    process.off('SIGTERM', handleSigterm);
    if (drainTimer) clearTimeout(drainTimer);
  };
}

module.exports = { installGracefulShutdown };
