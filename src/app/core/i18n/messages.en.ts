/**
 * The source dictionary. Every other language is typed against it, so a missing
 * or misspelled key is a compile error rather than a blank label at runtime.
 *
 * Values that interpolate take arguments instead of using placeholder syntax —
 * the type checker then guarantees each translation accepts the same data.
 */
export const en = {
  languageName: 'English',

  nav: {
    skipToContent: 'Skip to content',
    home: 'Soberish home',
    primary: 'Primary',
    tonight: 'Tonight',
    leaderboard: 'Top ‰',
    you: 'You',
  },

  shell: {
    offline: 'Offline',
    offlineTitle: 'Offline — everything still works',
    syncing: 'Syncing',
    install: 'Install',
  },

  time: {
    justNow: 'just now',
    hourSuffix: 'h',
    minuteSuffix: 'm',
  },

  status: {
    sober: { title: 'Sober', blurb: 'Nothing in the tank.' },
    buzzed: { title: 'Buzzed', blurb: 'Just getting warm.' },
    merry: { title: 'Merry', blurb: 'Comfortably social.' },
    drunk: { title: 'Drunk', blurb: 'Have a glass of water.' },
    wasted: { title: 'Wasted', blurb: 'Please stop and hydrate.' },
    kickingIn: { title: 'Kicking in', blurb: 'Drinks logged — absorption has just started.' },
  },

  /** Short band names, for the places too narrow for a full status title. */
  bands: {
    buzzed: 'Buzzed',
    merry: 'Merry',
    drunk: 'Drunk',
    wasted: 'Wasted',
  },

  readout: {
    rising: '↑ still rising',
    falling: '↓ coming down',
    empty: '— nothing on board',
    soberIn: (duration: string, clock: string) => `Sober in ${duration} · ${clock}`,
    aria: (permille: string) => `Blood alcohol ${permille} promille`,
    ariaSoberIn: (duration: string) => `, sober in ${duration}`,
  },

  chart: {
    aria: (current: string, peak: string) =>
      `Blood alcohol curve. Currently ${current} promille, session peak ${peak} promille.`,
    gestures: 'Drag to pan, pinch or scroll to zoom.',
    rangeGroup: 'Chart time range',
    hours: (n: number) => `${n}h`,
    wholeSession: 'Session',
    jumpToNow: 'Jump to now',
  },

  tracker: {
    statUnits: 'Units',
    statDrinks: 'Drinks',
    statPeak: 'Peak',
    statSession: 'Session',
    setWeightTitle: 'Set your weight for an accurate curve.',
    setWeightBody: (weight: string) => `Soberish is using ${weight} right now.`,
    logADrink: 'Log a drink',
    tonight: 'Tonight',
    clearsIn: (duration: string) => `clears in ${duration}`,
    clearsInTitle: 'History clears 24 hours after you sober up',
    disclaimer:
      "Estimates only. Widmark maths cannot account for food, medication, or your liver's mood — never use Soberish to decide whether to drive.",
  },

  quickAdd: {
    group: 'Log a drink',
    custom: 'Custom',
    customMeta: 'Any size',
    empty: 'Drinks you add with Custom show up here as shortcuts.',
  },

  drinkList: {
    edit: (label: string) => `Edit ${label}`,
    delete: (label: string) => `Delete ${label}`,
    units: (n: string) => `${n} units`,
    empty: 'Nothing logged yet — tap a drink above to start the night.',
  },

  editor: {
    addTitle: 'Add a drink',
    editTitle: 'Edit drink',
    defaultName: 'Beer',
    fallbackName: 'Drink',
    gramsAlcohol: (grams: string) => `${grams} g alcohol`,
    units: (n: string) => `${n} units`,
    whatIsIt: 'What is it?',
    iconGroup: 'Drink icon',
    name: 'Name',
    howMuch: (unit: string) => `How much? (${unit})`,
    exactVolume: 'Exact volume',
    exactVolumeAria: (unit: string) => `Exact volume in ${unit}`,
    millilitres: 'millilitres',
    ounces: 'ounces',
    howStrong: 'How strong? (% ABV)',
    exactAbv: 'Exact ABV',
    exactAbvAria: 'Exact alcohol by volume percentage',
    when: 'When?',
    now: 'Now',
    minus15: '−15 min',
    minus30: '−30 min',
    minus60: '−1 h',
    plus15: '+15 min',
    howLong: 'How long over it?',
    howLongHint:
      'Sipping the same drink slowly spreads the alcohol out, so it peaks lower and later.',
    inOneGo: 'In one go',
    minutes: (n: number) => {
      const hours = Math.floor(n / 60);
      const rest = n % 60;
      if (!hours) return `${rest} min`;
      return rest ? `${hours} h ${rest} min` : `${hours} h`;
    },
    minutesAgo: (n: number) => `${n} minutes ago`,
    delete: 'Delete',
    saveChanges: 'Save changes',
    add: 'Add drink',
  },

  planner: {
    title: 'Staying under a limit?',
    off: 'No limit',
    ceiling: (name: string, permille: string) => `${name} · ${permille}\u00a0‰`,
    exact: 'Exact limit (‰)',
    exactAria: 'Exact limit in promille',
    goNow: (peak: string) => `Go for it — this one tops out around ${peak}\u00a0‰.`,
    wait: (duration: string, clock: string, peak: string) =>
      `Wait ${duration}. Have it at ${clock} and you top out around ${peak}\u00a0‰.`,
    alreadyOver: (peak: string) =>
      `You're already heading for ${peak}\u00a0‰ — waiting won't bring that back under.`,
    tooBig: (peak: string) =>
      `Too big for this limit — even stone-cold sober it lands at ${peak}\u00a0‰.`,
    stretch: (duration: string) => `Or take ${duration} over it and have it now`,
    noAlcohol: 'No alcohol in this one. Have it whenever.',
    fromNow: 'Worked out from right now, whatever time is set above.',
  },

  leaderboard: {
    title: 'Top ‰',
    subtitle: 'Everyone currently above 0.00 ‰.',
    refresh: 'Refresh leaderboard',
    offlineOnlyTitle: 'Leaderboard is offline-only here',
    offlineOnlyBody:
      'This deployment was built without Supabase credentials, so Soberish runs entirely on your device. Add SUPABASE_URL and SUPABASE_ANON_KEY to the repository variables and redeploy to switch the board on.',
    offlineTitle: "You're offline",
    offlineBody: 'Your own BAC keeps tracking. The board will catch up when you reconnect.',
    errorTitle: "Couldn't load the board",
    emptyTitle: 'Nobody is drinking',
    emptyBody: 'The board fills up as soon as someone logs a drink.',
    units: (n: number) => `${n} units`,
    yourRank: (rank: number) => `You're currently ranked #${rank}.`,
    notRanked: "You're not on the board — log a drink to appear.",
    updatedAt: (clock: string) => `Updated ${clock}.`,
  },

  profile: {
    title: 'You',
    subtitle: 'These numbers shape the curve. Honest input, honest estimate.',

    bodySection: 'Body',
    weight: (value: string) => `Weight — ${value}`,
    weightAria: (unit: string) => `Weight in ${unit}`,
    weightHint: (min: string, max: string) => `Between ${min} and ${max}.`,
    kilograms: 'kilograms',
    pounds: 'pounds',
    bodyComposition: 'Body composition',
    female: 'Female',
    male: 'Male',
    average: 'Average',
    bodyCompositionHint: 'Sets the Widmark distribution ratio. "Average" sits between the two.',
    units: 'Units',
    metric: 'ml / kg',
    imperial: 'oz / lb',
    language: 'Language',

    metabolismSection: 'Metabolism',
    burnOff: (permille: string) => `Burn-off rate — ${permille} ‰ per hour`,
    burnOffHint: 'Most people sit around 0.15 ‰. Regular drinkers clear alcohol slightly faster.',
    absorption: (minutes: number) => `Absorption — ${minutes} min to full effect`,
    absorptionHint: 'Shorter on an empty stomach, longer after a big meal.',

    accountSection: 'Account & leaderboard',
    noSupabase:
      'This deployment has no Supabase configuration, so Soberish is running fully offline. Everything still works — it just stays on this device.',
    signOut: 'Sign out',
    leaderboardName: 'Leaderboard name',
    anonymous: 'Anonymous',
    shareTitle: 'Share my BAC',
    shareBody: "Publishes your name and current level while you're above 0.00 ‰.",

    syncLocalOnly: 'Local only',
    syncSyncing: 'Syncing…',
    syncRetrying: 'Retrying…',
    syncSynced: 'Synced',
    syncSignIn: 'Sign in to sync',
    syncOfflineSuffix: ' · offline',

    appSection: 'App',
    installed: '✅ Installed. Soberish runs offline from your home screen.',
    installCta: 'Add Soberish to Home Screen',
    installIos: 'To install: tap Share in Safari, then Add to Home Screen.',
    installIosShare: 'Share',
    installIosAdd: 'Add to Home Screen',
    installOther: 'Use your browser\'s "Install app" or "Add to Home Screen" menu item.',

    dataSection: 'Data',
    drinksStored: (n: number) => `${n} drinks stored`,
    autoClearsIn: (duration: string) => `Auto-clears in ${duration} — 24 h after you sobered up.`,
    autoClearsHint: 'History clears automatically 24 h after you hit 0.00 ‰.',
    exportJson: 'Export JSON',
    clearSession: 'Clear session',
    clearConfirm: (n: number) => `Delete all ${n} drinks from this session?`,

    disclaimer:
      'Soberish estimates BAC with the Widmark equation. Real blood alcohol depends on food, hydration, medication, genetics, and more. It is not a breathalyser and never a reason to drive.',
  },

  auth: {
    signIn: 'Sign in',
    createAccount: 'Create account',
    email: 'Email',
    password: 'Password',
    magicLink: 'Email me a magic link',
    fine: 'Your drinks stay on this device until you sign in. Signing in syncs them and puts you on the leaderboard — you can turn sharing off in You.',
    fineYou: 'You',
    notConfigured: 'Cloud sync is not configured for this deployment.',
  },

  toast: {
    logged: (icon: string, label: string) => `${icon} ${label} logged`,
    undo: 'Undo',
    drinkUpdated: 'Drink updated',
    drinkDeleted: (label: string) => `${label} deleted`,
    sessionCleared: 'Session cleared.',
    signedOut: 'Signed out. Your drinks stay on this device.',
    signedIn: 'Signed in.',
    confirmInbox: 'Check your inbox to confirm.',
    magicLinkSent: 'Magic link sent — check your inbox.',
    emailFirst: 'Enter your email first.',
    genericError: 'Something went wrong.',
    retentionWipe: (n: number) =>
      `Cleared ${n} drink${n === 1 ? '' : 's'} — you'd been sober for 24 hours.`,
    updateReady: 'A new version of Soberish is ready.',
    reload: 'Reload',
  },

  sheet: {
    close: 'Close',
  },
};

/** The shape every translation has to satisfy. */
export type Messages = typeof en;
