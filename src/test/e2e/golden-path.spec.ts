import { test, expect } from "@playwright/test";

// Parcours critique de bout en bout : création de tournoi -> inscriptions ->
// check-in -> lancement -> bracket -> saisie de score jusqu'à la victoire.
// Prérequis : base de données seedée (pnpm prisma:seed) — utilise l'établissement
// et le compte admin créés par le seed de démonstration.
test.describe("Parcours complet d'un tournoi", () => {
  test("créer, inscrire, lancer et jouer un tournoi jusqu'à la victoire", async ({ page }) => {
    const suffix = Date.now();
    const tournamentName = `E2E Tournoi ${suffix}`;
    const playerA = { first: "Alicee2e", last: `${suffix}` };
    const playerB = { first: "Bobe2e", last: `${suffix}` };

    // Le clavier de score demande une confirmation avant un checkout/retrait
    // (exigence produit "confirmation sur actions destructives") : on l'accepte
    // systématiquement pour ce parcours automatisé.
    page.on("dialog", (dialog) => dialog.accept());

    await test.step("Connexion admin", async () => {
      await page.goto("/login");
      await page.getByLabel("Email").fill("admin@bar.local");
      await page.getByLabel("Mot de passe").fill("admin123");
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page).toHaveURL("/");
    });

    await test.step("Créer un tournoi", async () => {
      await page.goto("/admin/tournaments/new");
      await page.getByLabel("Établissement").selectOption({ index: 1 });
      await page.getByLabel("Nom du tournoi").fill(tournamentName);
      await page.getByLabel("Format").selectOption("SINGLE_ELIMINATION");
      await page.getByLabel("Mode").selectOption("SOLO");
      await page.getByLabel("Sortie (out)").selectOption("STRAIGHT");
      await page.getByLabel("Manches gagnantes").fill("1");
      await page.getByRole("button", { name: "Créer le tournoi" }).click();
      await expect(page).toHaveURL(/\/admin\/tournaments\/[a-z0-9]+$/);
      await expect(page.getByRole("heading", { name: tournamentName })).toBeVisible();
    });

    await test.step("Ouvrir les inscriptions", async () => {
      await page.getByRole("button", { name: "Ouvrir les inscriptions" }).click();
      await expect(page.getByText("Inscriptions ouvertes")).toBeVisible();
    });

    await test.step("Inscrire deux joueurs et les check-in", async () => {
      await page.getByRole("link", { name: "Gérer les inscriptions" }).click();
      await expect(page).toHaveURL(/\/registrations$/);

      for (const player of [playerA, playerB]) {
        await page.getByRole("button", { name: "Nouveau joueur" }).click();
        await page.getByPlaceholder("Prénom").fill(player.first);
        await page.getByPlaceholder("Nom").fill(player.last);
        await page.getByRole("button", { name: "Inscrire", exact: true }).click();
        await expect(page.getByText(`${player.first} ${player.last}`)).toBeVisible();
      }

      const checkinButtons = page.getByRole("button", { name: "Check-in" });
      await checkinButtons.first().click();
      await expect(page.getByText("Check-in ✓").first()).toBeVisible();
      await checkinButtons.first().click();
      await expect(page.getByText("Check-in ✓")).toHaveCount(2);
    });

    await test.step("Fermer les inscriptions et lancer le tournoi", async () => {
      await page.goBack();
      await page.getByRole("button", { name: "Fermer les inscriptions" }).click();
      await page.getByRole("button", { name: "Lancer le tournoi" }).click();
      await expect(page.getByText("En cours")).toBeVisible();
    });

    await test.step("Vérifier que le bracket est généré", async () => {
      await page.getByRole("link", { name: "Voir le bracket" }).click();
      await expect(page.getByText(playerA.first, { exact: false })).toBeVisible();
      await expect(page.getByText(playerB.first, { exact: false })).toBeVisible();
    });

    await test.step("Jouer le match jusqu'à la victoire", async () => {
      await page.goto("/staff/matches");
      await page.getByText(playerA.first, { exact: false }).first().click();
      await expect(page).toHaveURL(/\/staff\/matches\/.+\/score$/);

      await page.getByRole("button", { name: "Démarrer le match" }).click();

      // 501 en sortie simple : 3 tours de 167 pour le vainqueur suffisent (167*3=501),
      // l'adversaire joue un tour neutre entre chaque pour respecter l'alternance.
      for (let i = 0; i < 3; i++) {
        await page.getByLabel("Autre score").fill("167");
        await page.getByRole("button", { name: "Valider le tour" }).click();
        await page.getByLabel("Autre score").fill("1");
        await page.getByRole("button", { name: "Valider le tour" }).click();
      }

      await expect(page.getByText("Match terminé")).toBeVisible({ timeout: 15_000 });
    });
  });
});
