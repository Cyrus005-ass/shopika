// ===================================================================
// Utilitaire CLI — définir (ou réinitialiser) le mot de passe d'un
// compte de test, sans passer par l'e-mail de vérification.
//
//   node src/scripts/set-password.js <téléphone|e-mail> <mot_de_passe>
//
// ⚠️ Développement uniquement : en production le mot de passe se
// change via POST /api/auth/change-password.
// ===================================================================
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const [identifier, password] = process.argv.slice(2);
  if (!identifier || !password) {
    console.error('Usage : node src/scripts/set-password.js <téléphone|e-mail> <mot_de_passe>');
    process.exitCode = 1;
    return;
  }
  if (password.length < 6) {
    console.error('Le mot de passe doit contenir au moins 6 caractères');
    process.exitCode = 1;
    return;
  }

  const isEmail = identifier.includes('@');
  const user = await prisma.user.findFirst({
    where: isEmail ? { email: identifier } : { phone: identifier },
  });
  if (!user) {
    console.error('Aucun compte trouvé pour %s', identifier);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });
  console.log('Mot de passe mis à jour pour %s (%s, rôle %s)', identifier, user.fullName, user.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
