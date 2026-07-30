/**
 * Seed de démonstration : un établissement complet, prêt à explorer dès
 * `docker compose up` (ou `pnpm prisma:seed` en local). Rejoue les flux métier via
 * les vrais services (pas d'écriture Prisma directe pour les matchs) afin que
 * l'historique, l'audit et les statistiques soient cohérents comme en conditions
 * réelles.
 *
 * Usage : pnpm prisma:seed (idempotent — peut être relancé sans dupliquer les
 * entités identifiées par un champ unique ; les tournois de démo, eux, sont
 * recréés à chaque exécution après nettoyage de la précédente démo).
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma/client";
import { createTournament, changeTournamentStatus } from "@/server/tournaments/tournament-service";
import { registerSolo, checkInRegistration } from "@/server/registrations/registration-service";
import { startMatch, submitThrow } from "@/server/scoring/scoring-service";

const DEMO_PLAYERS = [
  ["Jean", "Dupont"],
  ["Marie", "Martin"],
  ["Pierre", "Bernard"],
  ["Sophie", "Petit"],
  ["Nicolas", "Durand"],
  ["Camille", "Leroy"],
  ["Thomas", "Moreau"],
  ["Julie", "Simon"],
  ["Antoine", "Laurent"],
  ["Chloé", "Michel"],
  ["Lucas", "Garcia"],
  ["Emma", "David"],
  ["Hugo", "Bertrand"],
  ["Léa", "Roux"],
  ["Maxime", "Vincent"],
  ["Manon", "Fournier"],
] as const;

async function resetDemoData() {
  // Nettoie uniquement les données créées par ce seed (jamais les tables système) :
  // permet de relancer le script sans accumuler des tournois de démo en double.
  await prisma.auditLog.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.scoreEntry.deleteMany();
  await prisma.matchGame.deleteMany();
  await prisma.match.updateMany({ data: { nextMatchId: null } });
  await prisma.board.updateMany({ data: { currentMatchId: null } });
  await prisma.match.deleteMany();
  await prisma.registrationGroup.deleteMany();
  await prisma.tournamentRound.deleteMany();
  await prisma.group.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.scoringRules.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.playerStats.deleteMany();
  await prisma.player.deleteMany();
  await prisma.board.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
}

async function playMatchToCompletion(matchId: string, actorUserId: string) {
  await startMatch(matchId, actorUserId);

  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { tournament: { include: { scoringRules: true } } },
  });
  const regA = match.registrationAId!;
  const regB = match.registrationBId!;
  const outMode = match.tournament.scoringRules!.outMode;
  // Pour la démo, registrationA gagne systématiquement (déterministe et simple).
  const winner = regA;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Toujours relire le leg courant (id, version, tour attendu) en base plutôt que
    // de suivre des variables locales : un nouveau leg repart à la version 0 ET peut
    // démarrer avec l'un ou l'autre participant (alternance décidée côté serveur,
    // cf. finalizeLeg dans scoring-service.ts) — un simple flip local se désynchronise
    // dès le deuxième leg d'un match en plusieurs manches.
    const leg = await prisma.matchGame.findFirstOrThrow({ where: { matchId, status: "IN_PROGRESS" } });
    const lastEntry = await prisma.scoreEntry.findFirst({
      where: { legId: leg.id, isInvalidated: false },
      orderBy: { turnNumber: "desc" },
    });
    const turn = lastEntry ? (lastEntry.registrationId === regA ? regB : regA) : leg.startingRegistrationId!;
    const remaining = await getRemaining(matchId, turn);
    const isCheckoutAttempt = turn === winner && remaining <= 180;
    const score = isCheckoutAttempt ? (remaining <= 170 ? remaining : 167) : turn === winner ? 167 : 1;
    const result = await submitThrow(
      leg.id,
      {
        registrationId: turn,
        expectedLegVersion: leg.version,
        scoreValue: score,
        dartsUsed: 3,
        // Sortie double/master : la démo termine toujours sur une double fictive.
        lastDartWasDouble: isCheckoutAttempt && remaining <= 170 && outMode !== "STRAIGHT",
      },
      actorUserId,
    );
    // submitThrow déclenche déjà handleMatchCompletion en interne quand le match
    // se termine (voir scoring-service.ts) : pas besoin de le rappeler ici.
    if (result.matchCompleted) {
      break;
    }
  }
}

async function getRemaining(matchId: string, registrationId: string): Promise<number> {
  const leg = await prisma.matchGame.findFirst({ where: { matchId, status: "IN_PROGRESS" } });
  if (!leg) return 501;
  const lastEntry = await prisma.scoreEntry.findFirst({
    where: { legId: leg.id, registrationId, isInvalidated: false, isBust: false },
    orderBy: { turnNumber: "desc" },
  });
  return lastEntry ? lastEntry.remainingAfter : 501;
}

async function main() {
  console.log("Nettoyage des données de démo précédentes...");
  await resetDemoData();

  console.log("Création de l'établissement et des utilisateurs...");
  const venue = await prisma.venue.create({
    data: { name: "Le Fléchette d'Or", address: "12 rue des Lancers, 75000 Paris" },
  });
  await prisma.board.createMany({
    data: [
      { venueId: venue.id, label: "Plateau 1" },
      { venueId: venue.id, label: "Plateau 2" },
      { venueId: venue.id, label: "Plateau 3" },
    ],
  });

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const staffPasswordHash = await bcrypt.hash("staff123", 10);
  const admin = await prisma.user.create({
    data: { email: "admin@bar.local", passwordHash: adminPasswordHash, name: "Admin du Bar", role: "ADMIN" },
  });
  await prisma.user.create({
    data: { email: "staff1@bar.local", passwordHash: staffPasswordHash, name: "Julie Staff", role: "STAFF" },
  });
  await prisma.user.create({
    data: { email: "staff2@bar.local", passwordHash: staffPasswordHash, name: "Marc Staff", role: "STAFF" },
  });

  console.log("Création des joueurs...");
  const players = await Promise.all(
    DEMO_PLAYERS.map(([firstName, lastName]) =>
      prisma.player.create({
        data: { firstName, lastName, displayName: `${firstName} ${lastName}` },
      }),
    ),
  );

  console.log("Création de deux équipes de démonstration...");
  await prisma.team.create({
    data: {
      name: "Les Aigles",
      members: { create: [{ playerId: players[0]!.id }, { playerId: players[1]!.id }] },
    },
  });
  await prisma.team.create({
    data: {
      name: "Les Faucons",
      members: { create: [{ playerId: players[2]!.id }, { playerId: players[3]!.id }] },
    },
  });

  // ---------- Tournoi A : Round Robin COMPLETED (historique + classement + stats) ----------
  console.log("Tournoi A (Round Robin, terminé) — simulation complète...");
  const tournamentA = await createTournament(
    {
      venueId: venue.id,
      name: "Soirée Ligue du Mardi",
      format: "ROUND_ROBIN",
      mode: "SOLO",
      minParticipants: 2,
      tieBreakRule: "LEG_DIFFERENCE",
      formatConfig: {},
      scoringRules: { gameType: "X501", inMode: "STRAIGHT", outMode: "STRAIGHT", legsToWinSet: 1, setsToWinMatch: 1 },
    },
    admin.id,
  );
  await changeTournamentStatus(tournamentA.id, "REGISTRATION_OPEN", admin.id);

  const groupAPlayers = players.slice(0, 5);
  const groupARegistrations = [];
  for (const player of groupAPlayers) {
    const reg = await registerSolo({ tournamentId: tournamentA.id, playerId: player.id }, admin.id);
    groupARegistrations.push(reg);
  }
  for (const reg of groupARegistrations) {
    await checkInRegistration(reg.id, admin.id);
  }
  await changeTournamentStatus(tournamentA.id, "REGISTRATION_CLOSED", admin.id);
  await changeTournamentStatus(tournamentA.id, "IN_PROGRESS", admin.id);

  // Joue tous les matchs jusqu'à la clôture automatique du tournoi.
  let tournamentAStatus = "IN_PROGRESS";
  while (tournamentAStatus !== "COMPLETED") {
    const readyMatch = await prisma.match.findFirst({ where: { tournamentId: tournamentA.id, status: "READY" } });
    if (!readyMatch) break;
    await playMatchToCompletion(readyMatch.id, admin.id);
    tournamentAStatus = (await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentA.id } })).status;
  }
  console.log(`Tournoi A terminé, statut final : ${tournamentAStatus}`);

  // ---------- Tournoi B : Single Elimination IN_PROGRESS (démo TV + saisie live) ----------
  console.log("Tournoi B (Élimination directe, en cours)...");
  const tournamentB = await createTournament(
    {
      venueId: venue.id,
      name: "Coupe du Bar — Édition 2026",
      format: "SINGLE_ELIMINATION",
      mode: "SOLO",
      minParticipants: 2,
      tieBreakRule: "LEG_DIFFERENCE",
      formatConfig: {},
      scoringRules: { gameType: "X501", inMode: "STRAIGHT", outMode: "DOUBLE", legsToWinSet: 3, setsToWinMatch: 1 },
    },
    admin.id,
  );
  await changeTournamentStatus(tournamentB.id, "REGISTRATION_OPEN", admin.id);

  const groupBPlayers = players.slice(5, 11);
  const groupBRegistrations = [];
  for (const player of groupBPlayers) {
    const reg = await registerSolo({ tournamentId: tournamentB.id, playerId: player.id }, admin.id);
    groupBRegistrations.push(reg);
  }
  for (const reg of groupBRegistrations) {
    await checkInRegistration(reg.id, admin.id);
  }
  await changeTournamentStatus(tournamentB.id, "REGISTRATION_CLOSED", admin.id);
  await changeTournamentStatus(tournamentB.id, "IN_PROGRESS", admin.id);

  // Termine un premier match pour montrer une progression déjà entamée...
  const firstReadyMatch = await prisma.match.findFirst({ where: { tournamentId: tournamentB.id, status: "READY" } });
  if (firstReadyMatch) {
    await playMatchToCompletion(firstReadyMatch.id, admin.id);
  }
  // ...puis démarre un second match et laisse quelques tours en cours (démo live).
  const liveMatch = await prisma.match.findFirst({ where: { tournamentId: tournamentB.id, status: "READY" } });
  if (liveMatch) {
    await startMatch(liveMatch.id, admin.id);
    const leg = await prisma.matchGame.findFirstOrThrow({ where: { matchId: liveMatch.id, status: "IN_PROGRESS" } });
    await submitThrow(leg.id, { registrationId: liveMatch.registrationAId!, expectedLegVersion: 0, scoreValue: 140, dartsUsed: 3 }, admin.id);
    await submitThrow(leg.id, { registrationId: liveMatch.registrationBId!, expectedLegVersion: 1, scoreValue: 60, dartsUsed: 3 }, admin.id);
    await submitThrow(leg.id, { registrationId: liveMatch.registrationAId!, expectedLegVersion: 2, scoreValue: 100, dartsUsed: 3 }, admin.id);
  }
  console.log("Tournoi B laissé en cours, avec un match en direct.");

  // ---------- Tournoi C : brouillon (démo du flux de création) ----------
  console.log("Tournoi C (brouillon)...");
  await createTournament(
    {
      venueId: venue.id,
      name: "Tournoi par équipes du samedi",
      format: "ROUND_ROBIN",
      mode: "TEAM",
      minParticipants: 2,
      tieBreakRule: "LEG_DIFFERENCE",
      formatConfig: {},
      scoringRules: { gameType: "CRICKET", inMode: "STRAIGHT", outMode: "STRAIGHT", legsToWinSet: 3, setsToWinMatch: 1 },
    },
    admin.id,
  );

  console.log("\nSeed terminé !");
  console.log("Connexion admin : admin@bar.local / admin123");
  console.log("Connexion staff : staff1@bar.local / staff123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
