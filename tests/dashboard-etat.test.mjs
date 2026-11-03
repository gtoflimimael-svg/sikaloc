import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compterEtapesConfigurees,
  determinerActionContextuelleDashboard,
  determinerActionPrincipaleDemarrage,
  determinerEtatDashboardPro,
  periodeCouranteDashboard,
  peutCreerBail,
  presenterRecouvrementDashboard,
} from '../src/lib/dashboard/etat.ts'

test('un bailleur sans logement voit l’état de démarrage', () => {
  assert.equal(determinerEtatDashboardPro(0, 0), 'demarrage')
})

test('un bailleur avec logement mais sans bail voit l’état intermédiaire', () => {
  assert.equal(determinerEtatDashboardPro(1, 0), 'intermediaire')
})

test('tout bail enregistré conserve le dashboard opérationnel, y compris historique', () => {
  assert.equal(determinerEtatDashboardPro(1, 1), 'operationnel')
  assert.equal(determinerEtatDashboardPro(0, 1), 'operationnel')
})

test('la progression compte les entités enregistrées, jamais les clics', () => {
  assert.equal(compterEtapesConfigurees({ nbLogements: 0, nbLocataires: 0, nbBaux: 0 }), 0)
  assert.equal(compterEtapesConfigurees({ nbLogements: 1, nbLocataires: 0, nbBaux: 0 }), 1)
  assert.equal(compterEtapesConfigurees({ nbLogements: 1, nbLocataires: 1, nbBaux: 1 }), 3)
})

test('la création d’un bail est proposée seulement avec logement libre et locataire', () => {
  assert.equal(peutCreerBail({ nbLogementsLibres: 0, nbLocataires: 1 }), false)
  assert.equal(peutCreerBail({ nbLogementsLibres: 1, nbLocataires: 0 }), false)
  assert.equal(peutCreerBail({ nbLogementsLibres: 1, nbLocataires: 1 }), true)
})

test('un logement vacant sans locataire met Find en avant sans imposer de fiche locataire', () => {
  assert.equal(determinerActionPrincipaleDemarrage({ nbLogements: 0, nbLocataires: 0 }), 'logement')
  assert.equal(determinerActionPrincipaleDemarrage({ nbLogements: 1, nbLocataires: 0 }), 'find')
  assert.equal(determinerActionPrincipaleDemarrage({ nbLogements: 1, nbLocataires: 1 }), 'bail')
})

test('le dashboard priorise un versement à enregistrer seulement pour un bail actif et un écart réel', () => {
  assert.equal(determinerActionContextuelleDashboard({
    nbBauxActifs: 1,
    nbLogementsLibres: 0,
    nbLocataires: 1,
    loyerAttendu: 80000,
    loyerPercu: 30000,
    logementLibreSansAnnonce: false,
  }), 'enregistrer-paiement')
  assert.equal(determinerActionContextuelleDashboard({
    nbBauxActifs: 0,
    nbLogementsLibres: 0,
    nbLocataires: 0,
    loyerAttendu: 80000,
    loyerPercu: 0,
    logementLibreSansAnnonce: false,
  }), 'aucune')
})

test('la prochaine action n’invite pas à enregistrer un second paiement à confirmer', () => {
  const contexte = {
    nbBauxActifs: 1,
    nbLogementsLibres: 0,
    nbLocataires: 1,
    loyerAttendu: 80000,
    loyerPercu: 0,
    logementLibreSansAnnonce: false,
  }
  assert.equal(determinerActionContextuelleDashboard({ ...contexte, nbBrouillons: 1 }), 'aucune')
  assert.equal(determinerActionContextuelleDashboard({ ...contexte, nbImpayes: 1 }), 'aucune')
  assert.equal(determinerActionContextuelleDashboard({ ...contexte, suiviUrgentConnu: false }), 'aucune')
})

test('la prochaine action suit les vrais prérequis du logement vacant', () => {
  assert.equal(determinerActionContextuelleDashboard({
    nbBauxActifs: 0,
    nbLogementsLibres: 1,
    nbLocataires: 1,
    loyerAttendu: 0,
    loyerPercu: 0,
    logementLibreSansAnnonce: true,
  }), 'creer-bail')
  assert.equal(determinerActionContextuelleDashboard({
    nbBauxActifs: 0,
    nbLogementsLibres: 1,
    nbLocataires: 0,
    loyerAttendu: 0,
    loyerPercu: 0,
    logementLibreSansAnnonce: true,
  }), 'preparer-annonce')
  assert.equal(determinerActionContextuelleDashboard({
    nbBauxActifs: 0,
    nbLogementsLibres: 0,
    nbLocataires: 1,
    loyerAttendu: 0,
    loyerPercu: 0,
    logementLibreSansAnnonce: false,
  }), 'aucune')
})

test('le recouvrement distingue absence d’attendu, zéro, partiel et règlement complet', () => {
  assert.deepEqual(presenterRecouvrementDashboard(0, 0), {
    attendu: 0,
    attenduComplet: true,
    nbConditionsApreciser: 0,
    valide: 0,
    taux: null,
    progression: null,
    reste: 0,
    excedent: 0,
  })
  assert.equal(presenterRecouvrementDashboard(20000, 0)?.taux, 0)
  assert.equal(presenterRecouvrementDashboard(20000, 0)?.progression, 0)
  assert.equal(presenterRecouvrementDashboard(20000, 8000)?.taux, 40)
  assert.equal(presenterRecouvrementDashboard(20000, 8000)?.reste, 12000)
  assert.equal(presenterRecouvrementDashboard(20000, 20000)?.taux, 100)
  assert.equal(presenterRecouvrementDashboard(20000, 20000)?.progression, 100)
})

test('un excédent reste visible sans faire dépasser la barre de son échelle', () => {
  assert.deepEqual(presenterRecouvrementDashboard(20000, 25000), {
    attendu: 20000,
    attenduComplet: true,
    nbConditionsApreciser: 0,
    valide: 25000,
    taux: 125,
    progression: 100,
    reste: 0,
    excedent: 5000,
  })
})

test('un premier loyer indéterminé empêche un taux de recouvrement trompeur', () => {
  assert.deepEqual(presenterRecouvrementDashboard(100000, 50000, 1), {
    attendu: 100000,
    attenduComplet: false,
    nbConditionsApreciser: 1,
    valide: 50000,
    taux: null,
    progression: null,
    reste: 0,
    excedent: 0,
  })
})

test('une valeur financière indisponible ne devient pas un zéro d’affichage', () => {
  assert.equal(presenterRecouvrementDashboard(null, 0), null)
  assert.equal(presenterRecouvrementDashboard(10000, Number.NaN), null)
  assert.equal(presenterRecouvrementDashboard(0, 4000)?.taux, null)
})

test('le libellé du mois suit la date civile UTC utilisée par la vue mensuelle', () => {
  assert.equal(periodeCouranteDashboard(new Date('2026-11-01T00:30:00+01:00')), '2026-10-01')
  assert.equal(periodeCouranteDashboard(new Date('2026-11-01T00:30:00Z')), '2026-11-01')
})
