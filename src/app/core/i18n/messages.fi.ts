import { Messages } from './messages.en';

/**
 * Finnish, written the way a Finn would actually talk about a night out rather
 * than as a literal translation — the humour is the point.
 *
 * Numbers keep their decimal point: the readouts come from `toFixed`, and copy
 * that said "0,00 ‰" while the hero number said "0.00 ‰" would look broken.
 */
export const fi: Messages = {
  languageName: 'Suomi',

  nav: {
    skipToContent: 'Hyppää sisältöön',
    home: 'Soberishin etusivu',
    primary: 'Päävalikko',
    tonight: 'Ilta',
    leaderboard: 'Kärki ‰',
    you: 'Sinä',
  },

  shell: {
    offline: 'Katveessa',
    offlineTitle: 'Ei verkkoa — kaikki toimii silti',
    syncing: 'Synkataan',
    install: 'Asenna',
  },

  time: {
    justNow: 'juuri äsken',
    hourSuffix: 't',
    minuteSuffix: 'min',
  },

  status: {
    sober: { title: 'Selvä pyy', blurb: 'Tankki on tyhjä.' },
    buzzed: { title: 'Nousuhumala', blurb: 'Alkaa vähän lämmittää.' },
    merry: { title: 'Hyvässä hiprakassa', blurb: 'Sopivan sosiaalinen.' },
    drunk: { title: 'Kunnon kännissä', blurb: 'Ota välillä lasi vettä.' },
    wasted: { title: 'Perseet olalla', blurb: 'Nyt riittää. Vettä ja nukkumaan.' },
    kickingIn: { title: 'Kohta iskee', blurb: 'Juoma kirjattu — imeytyminen käynnistyi juuri.' },
  },

  readout: {
    rising: '↑ nousee vielä',
    falling: '↓ laskee jo',
    empty: '— tankki tyhjä',
    soberIn: (duration: string, clock: string) => `Selvänä ${duration} päästä · klo ${clock}`,
    aria: (permille: string) => `Veren alkoholipitoisuus ${permille} promillea`,
    ariaSoberIn: (duration: string) => `, selvänä ${duration} päästä`,
  },

  chart: {
    aria: (current: string, peak: string) =>
      `Promillekäyrä. Nyt ${current} promillea, illan huippu ${peak} promillea.`,
    gestures: 'Vedä siirtääksesi, nipistä tai rullaa zoomataksesi.',
    rangeGroup: 'Kuvaajan aikaväli',
    hours: (n: number) => `${n} t`,
    wholeSession: 'Ilta',
    jumpToNow: 'Hyppää nykyhetkeen',
  },

  tracker: {
    statUnits: 'Annosta',
    statDrinks: 'Juomia',
    statPeak: 'Huippu',
    statSession: 'Ilta',
    setWeightTitle: 'Aseta painosi, niin käyrä pitää kutinsa.',
    setWeightBody: (weight: string) => `Soberish veikkaa nyt ${weight}.`,
    logADrink: 'Kirjaa juoma',
    tonight: 'Illan saldo',
    clearsIn: (duration: string) => `tyhjenee ${duration} päästä`,
    clearsInTitle: 'Historia tyhjenee 24 tuntia selviämisen jälkeen',
    disclaimer:
      'Pelkkä arvio. Widmarkin kaava ei tiedä ruoasta, lääkkeistä eikä maksasi mielialasta — älä ikinä päätä ajamisesta Soberishin perusteella.',
  },

  quickAdd: {
    group: 'Kirjaa juoma',
    custom: 'Oma',
    customMeta: 'Mikä vain',
    empty: 'Omalla-napilla lisätyt juomat ilmestyvät tähän pikavalinnoiksi.',
  },

  drinkList: {
    edit: (label: string) => `Muokkaa: ${label}`,
    delete: (label: string) => `Poista: ${label}`,
    units: (n: string) => `${n} annosta`,
    empty: 'Ei vielä mitään — napauta juomaa yltä, niin ilta alkaa.',
  },

  editor: {
    addTitle: 'Lisää juoma',
    editTitle: 'Muokkaa juomaa',
    defaultName: 'Olut',
    fallbackName: 'Juoma',
    gramsAlcohol: (grams: string) => `${grams} g alkoholia`,
    units: (n: string) => `${n} annosta`,
    whatIsIt: 'Mikä se on?',
    iconGroup: 'Juoman kuvake',
    name: 'Nimi',
    howMuch: (unit: string) => `Kuinka paljon? (${unit})`,
    exactVolume: 'Tarkka tilavuus',
    exactVolumeAria: (unit: string) => `Tarkka tilavuus, ${unit}`,
    millilitres: 'millilitraa',
    ounces: 'unssia',
    howStrong: 'Kuinka vahvaa? (til-%)',
    exactAbv: 'Tarkka vahvuus',
    exactAbvAria: 'Tarkka alkoholipitoisuus prosentteina',
    when: 'Milloin?',
    now: 'Nyt',
    minus15: '−15 min',
    minus30: '−30 min',
    minus60: '−1 t',
    plus15: '+15 min',
    minutesAgo: (n: number) => `${n} minuutti${n === 1 ? '' : 'a'} sitten`,
    delete: 'Poista',
    saveChanges: 'Tallenna',
    add: 'Lisää juoma',
  },

  planner: {
    title: 'Pysytkö rajan alla?',
    off: 'Ei rajaa',
    presets: { buzzed: 'Nousussa', merry: 'Hiprakassa', drunk: 'Kännissä' },
    ceiling: (name: string, permille: string) => `${name} · ${permille}\u00a0‰`,
    exact: 'Tarkka raja (‰)',
    exactAria: 'Tarkka raja promilleina',
    goNow: (peak: string) => `Ota vaan — huippu jää noin ${peak} promilleen.`,
    wait: (duration: string, clock: string, peak: string) =>
      `Odota ${duration}. Klo ${clock} otettuna huipuksi jää noin ${peak}\u00a0‰.`,
    alreadyOver: (peak: string) =>
      `Olet menossa jo ${peak} promilleen — odottaminen ei enää pelasta.`,
    tooBig: (peak: string) => `Liian iso tähän rajaan — selvinkin päin tästä tulee ${peak}\u00a0‰.`,
    noAlcohol: 'Ei alkoholia. Ota milloin huvittaa.',
    fromNow: 'Laskettu tästä hetkestä, riippumatta yllä valitusta ajasta.',
  },

  leaderboard: {
    title: 'Kärki ‰',
    subtitle: 'Kaikki jotka ovat juuri nyt yli 0.00 ‰.',
    refresh: 'Päivitä lista',
    offlineOnlyTitle: 'Tulostaulu on täällä pelkkä haave',
    offlineOnlyBody:
      'Tämä asennus rakennettiin ilman Supabase-tunnuksia, joten Soberish pyörii kokonaan omalla laitteellasi. Lisää SUPABASE_URL ja SUPABASE_ANON_KEY repositorion muuttujiin ja julkaise uudelleen, niin taulu herää henkiin.',
    offlineTitle: 'Olet katveessa',
    offlineBody: 'Omat promillesi lasketaan silti. Taulu ottaa kiinni kun verkko palaa.',
    errorTitle: 'Taulua ei saatu ladattua',
    emptyTitle: 'Kukaan ei juo',
    emptyBody: 'Taulu täyttyy heti kun joku kirjaa ensimmäisen juomansa.',
    units: (n: number) => (n === 1 ? '1 annos' : `${n} annosta`),
    yourRank: (rank: number) => `Olet tällä hetkellä sijalla ${rank}.`,
    notRanked: 'Et ole taulussa — kirjaa juoma, niin pääset mukaan.',
    updatedAt: (clock: string) => `Päivitetty klo ${clock}.`,
  },

  profile: {
    title: 'Sinä',
    subtitle: 'Nämä luvut muovaavat käyrän. Rehellinen syöte, rehellinen arvio.',

    bodySection: 'Keho',
    weight: (value: string) => `Paino — ${value}`,
    bodyComposition: 'Kehonkoostumus',
    female: 'Nainen',
    male: 'Mies',
    average: 'Keskiverto',
    bodyCompositionHint:
      'Asettaa Widmarkin jakautumiskertoimen. "Keskiverto" osuu näiden kahden väliin.',
    units: 'Yksiköt',
    metric: 'ml / kg',
    imperial: 'oz / lb',
    language: 'Kieli',

    metabolismSection: 'Aineenvaihdunta',
    burnOff: (permille: string) => `Palamisnopeus — ${permille} ‰ tunnissa`,
    burnOffHint: 'Useimmilla noin 0.15 ‰. Tottuneella juojalla hieman ripeämmin.',
    absorption: (minutes: number) => `Imeytyminen — ${minutes} min täyteen tehoon`,
    absorptionHint: 'Tyhjään mahaan nopeammin, ison aterian päälle hitaammin.',

    accountSection: 'Tili ja tulostaulu',
    noSupabase:
      'Tässä asennuksessa ei ole Supabase-asetuksia, joten Soberish toimii täysin ilman verkkoa. Kaikki toimii silti — tiedot vain pysyvät tällä laitteella.',
    signOut: 'Kirjaudu ulos',
    leaderboardName: 'Nimi tulostaulussa',
    anonymous: 'Nimetön',
    shareTitle: 'Jaa promilleni',
    shareBody: 'Julkaisee nimesi ja tasosi aina kun olet yli 0.00 ‰.',

    syncLocalOnly: 'Vain tällä laitteella',
    syncSyncing: 'Synkataan…',
    syncRetrying: 'Yritetään uudelleen…',
    syncSynced: 'Synkattu',
    syncSignIn: 'Kirjaudu synkataksesi',
    syncOfflineSuffix: ' · katveessa',

    appSection: 'Sovellus',
    installed: '✅ Asennettu. Soberish pyörii ilman verkkoa suoraan kotivalikosta.',
    installCta: 'Lisää Soberish kotivalikkoon',
    installIos: 'Asennus: napauta Safarissa Jaa ja sitten Lisää Koti-valikkoon.',
    installIosShare: 'Jaa',
    installIosAdd: 'Lisää Koti-valikkoon',
    installOther: 'Käytä selaimesi "Asenna sovellus"- tai "Lisää kotivalikkoon" -valintaa.',

    dataSection: 'Tiedot',
    drinksStored: (n: number) => `${n} juoma${n === 1 ? '' : 'a'} tallessa`,
    autoClearsIn: (duration: string) =>
      `Tyhjenee itsestään ${duration} päästä — 24 t selviämisestäsi.`,
    autoClearsHint: 'Historia tyhjenee itsestään 24 t sen jälkeen kun olet 0.00 ‰.',
    exportJson: 'Vie JSON',
    clearSession: 'Tyhjennä ilta',
    clearConfirm: (n: number) => `Poistetaanko kaikki ${n} juomaa tästä illasta?`,

    disclaimer:
      'Soberish arvioi promillet Widmarkin kaavalla. Todellinen lukema riippuu ruoasta, nesteytyksestä, lääkkeistä, geeneistä ja muusta. Tämä ei ole alkometri eikä ikinä syy lähteä rattiin.',
  },

  auth: {
    signIn: 'Kirjaudu',
    createAccount: 'Luo tili',
    email: 'Sähköposti',
    password: 'Salasana',
    magicLink: 'Lähetä taikalinkki sähköpostiin',
    fine: 'Juomasi pysyvät tällä laitteella kunnes kirjaudut. Kirjautuminen synkkaa ne ja vie sinut tulostauluun — jakamisen voi napsauttaa pois Sinä-välilehdeltä.',
    fineYou: 'Sinä',
    notConfigured: 'Pilvisynkkausta ei ole määritetty tähän asennukseen.',
  },

  toast: {
    logged: (icon: string, label: string) => `${icon} ${label} kirjattu`,
    undo: 'Kumoa',
    drinkUpdated: 'Juoma päivitetty',
    drinkDeleted: (label: string) => `${label} poistettu`,
    sessionCleared: 'Ilta tyhjennetty.',
    signedOut: 'Kirjauduit ulos. Juomat jäävät tälle laitteelle.',
    signedIn: 'Kirjauduttu sisään.',
    confirmInbox: 'Vahvista tili sähköpostistasi.',
    magicLinkSent: 'Taikalinkki lähetetty — vilkaise sähköpostia.',
    emailFirst: 'Syötä ensin sähköpostisi.',
    genericError: 'Jokin meni pieleen.',
    retentionWipe: (n: number) =>
      `Tyhjennettiin ${n} juoma${n === 1 ? '' : 'a'} — olit ollut selvin päin 24 tuntia.`,
    updateReady: 'Soberishista on uusi versio valmiina.',
    reload: 'Lataa uudelleen',
  },

  sheet: {
    close: 'Sulje',
  },
};
