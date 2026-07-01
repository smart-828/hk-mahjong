// ── Translations ─────────────────────────────────────────────
// All UI strings in English (en) and Traditional Chinese (zh)
// Tile graphics always use Chinese — this covers UI chrome only

const translations = {
  en: {
    // Auth
    appName:        'HK Mahjong',
    appSubtitle:    'Hong Kong Style • Async Multiplayer',
    signIn:         'Sign in',
    signInGoogle:   'Continue with Google',
    signInEmail:    'Continue with Email',
    email:          'Email',
    password:       'Password',
    displayName:    'Display name',
    createAccount:  'Create account',
    orContinueWith: 'or',
    noAccount:      'No account?',
    hasAccount:     'Already have an account?',
    signOut:        'Sign out',

    // Profile setup
    profileSetup:   'Set up your profile',
    chooseLanguage: 'Choose your language',
    save:           'Save',

    // Lobby
    createRoom:     'Create room',
    joinRoom:       'Join room',
    roomCode:       'Room code',
    enterCode:      'Enter 4-letter code',
    join:           'Join',
    myGames:        'My games',
    noActiveGames:  'No active games',
    leaderboard:    'Leaderboard',

    // Leaderboard
    rank:           'Rank',
    totalScore:     'Score',
    gamesPlayed:    'Games',
    noScoresYet:    'No scores recorded yet',

    // Room / Seat selection
    roomSettings:   'Room settings',
    seats:          'Seats',
    human:          'Human',
    ai:             'AI',
    aiEasy:         'AI — Easy',
    aiMedium:       'AI — Medium',
    aiHard:         'AI — Hard',
    waitingForPlayers: 'Waiting for players…',
    startGame:      'Start game',
    shareCode:      'Share room code',
    copyCode:       'Copy code',
    copied:         'Copied!',

    // Room settings labels
    minFaan:        'Minimum faan to win',
    scoringTable:   'Scoring table',
    fullSpicy:      'Full spicy (全辣)',
    halfSpicy:      'Half spicy (半辣)',
    limitValue:     'Limit hand value',
    claimTimeout:   'Claim timeout',
    hours12:        '12 hours',
    hours24:        '24 hours',
    hours48:        '48 hours',
    hours72:        '72 hours',
    autoDiscard:    'Auto-discard on timeout',
    rounds:         'Rounds',
    round1:         '1 round (East only)',
    round2:         '2 rounds',
    round4:         '4 rounds (full game)',
    allow13orphans: 'Allow Thirteen Orphans (十三么)',
    allowHeavenly:  'Allow Heavenly/Earthly hand (天糊/地糊)',

    // Seat winds
    east:           'East',
    south:          'South',
    west:           'West',
    north:          'North',

    // Game UI
    yourHand:       'Your hand',
    yourTurn:       'Your turn',
    waitingFor:     'Waiting for',
    dealer:         'Dealer',
    prevailingWind: 'Prevailing wind',
    tilesLeft:      'Tiles left',
    claimWindow:    'Claim window',
    timeLeft:       'Time left',

    // Actions
    win:            'Win',
    pong:           'Pong',
    chow:           'Chow',
    kong:           'Kong',
    discard:        'Discard',
    pass:           'Pass',
    draw:           'Draw',

    // Discard pool
    discardPool:    'Discard pool',
    lastDiscard:    'Last discard',

    // Win screen
    winner:         'Winner!',
    handScore:      'Hand score',
    faan:           'faan',
    payment:        'Payment',
    pays:           'pays',
    total:          'Total',
    nextHand:       'Next hand',

    // Draw
    draw_result:    'Draw — no winner',
    redealing:      'Redealing…',

    // Claim resolution overlay
    claimResult:    'Claims',
    allPassed:      'All passed',
    discarded:      'Discarded',

    // Errors
    invalidHand:    'Invalid hand — not enough faan',
    falseMahjong:   'False mahjong — penalty applied',
    roomNotFound:   'Room not found',
    roomFull:       'Room is full',
    gameInProgress: 'Game already in progress',
  },

  zh: {
    // Auth
    appName:        '香港麻雀',
    appSubtitle:    '港式麻雀 • 非同步多人遊戲',
    signIn:         '登入',
    signInGoogle:   '以 Google 繼續',
    signInEmail:    '以電郵繼續',
    email:          '電郵',
    password:       '密碼',
    displayName:    '顯示名稱',
    createAccount:  '建立帳號',
    orContinueWith: '或',
    noAccount:      '未有帳號？',
    hasAccount:     '已有帳號？',
    signOut:        '登出',

    // Profile setup
    profileSetup:   '設定你的檔案',
    chooseLanguage: '選擇語言',
    save:           '儲存',

    // Lobby
    createRoom:     '建立房間',
    joinRoom:       '加入房間',
    roomCode:       '房間號碼',
    enterCode:      '輸入4位字母',
    join:           '加入',
    myGames:        '我的遊戲',
    noActiveGames:  '沒有進行中的遊戲',
    leaderboard:    '排行榜',

    // Leaderboard
    rank:           '排名',
    totalScore:     '積分',
    gamesPlayed:    '場數',
    noScoresYet:    '暫無積分記錄',

    // Room / Seat selection
    roomSettings:   '房間設定',
    seats:          '座位',
    human:          '真人',
    ai:             '電腦',
    aiEasy:         '電腦 — 簡單',
    aiMedium:       '電腦 — 中等',
    aiHard:         '電腦 — 困難',
    waitingForPlayers: '等待玩家加入…',
    startGame:      '開始遊戲',
    shareCode:      '分享房間號碼',
    copyCode:       '複製號碼',
    copied:         '已複製！',

    // Room settings labels
    minFaan:        '最低番數',
    scoringTable:   '計分方式',
    fullSpicy:      '全辣',
    halfSpicy:      '半辣',
    limitValue:     '最高限番',
    claimTimeout:   '認牌時限',
    hours12:        '12小時',
    hours24:        '24小時',
    hours48:        '48小時',
    hours72:        '72小時',
    autoDiscard:    '逾時自動出牌',
    rounds:         '局數',
    round1:         '一局（東風局）',
    round2:         '兩局',
    round4:         '四局（全場）',
    allow13orphans: '允許十三么',
    allowHeavenly:  '允許天糊/地糊',

    // Seat winds
    east:           '東',
    south:          '南',
    west:           '西',
    north:          '北',

    // Game UI
    yourHand:       '你的手牌',
    yourTurn:       '輪到你了',
    waitingFor:     '等待',
    dealer:         '莊家',
    prevailingWind: '場風',
    tilesLeft:      '剩餘牌數',
    claimWindow:    '認牌時間',
    timeLeft:       '剩餘時間',

    // Actions
    win:            '胡',
    pong:           '碰',
    chow:           '吃',
    kong:           '槓',
    discard:        '出牌',
    pass:           '過',
    draw:           '摸牌',

    // Discard pool
    discardPool:    '棄牌池',
    lastDiscard:    '最新出牌',

    // Win screen
    winner:         '糊牌！',
    handScore:      '手牌分數',
    faan:           '番',
    payment:        '收款',
    pays:           '付',
    total:          '合計',
    nextHand:       '下一局',

    // Draw
    draw_result:    '荒牌 — 無人勝出',
    redealing:      '重新發牌…',

    // Claim resolution overlay
    claimResult:    '認牌結果',
    allPassed:      '全部過',
    discarded:      '出牌',

    // Errors
    invalidHand:    '無效手牌 — 番數不足',
    falseMahjong:   '詐糊 — 已罰款',
    roomNotFound:   '找不到房間',
    roomFull:       '房間已滿',
    gameInProgress: '遊戲已開始',
  },
}

export default translations

export function t(lang, key) {
  return translations[lang]?.[key] ?? translations['en'][key] ?? key
}
