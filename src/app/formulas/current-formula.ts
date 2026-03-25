// Current plates start at a base price of £500

export enum CurrentReg {
    start = 250
}

export enum CurrentRegLength {
    _7 = 0
}

export enum CurrentRegMultiplier {
    _7 = 1
}

export const CurrentRegYearMultiplier: Record<string, number> = {
    // Future Plates (lowest value = furthest future)
    '99': 100,  // Sept 2049
    '49': 110,  // Mar 2049
    '98': 120,  // Sept 2048
    '48': 130,  // Mar 2048
    '97': 140,  // Sept 2047
    '47': 150,  // Mar 2047
    '96': 160,  // Sept 2046
    '46': 170,  // Mar 2046
    '95': 180,  // Sept 2045
    '45': 190,  // Mar 2045
    '94': 200,
    '44': 210,
    '93': 220,
    '43': 230,
    '92': 240,
    '42': 250,
    '91': 260,
    '41': 270,
    '90': 280,
    '40': 290,
    '89': 300,
    '39': 310,
    '88': 320,
    '38': 330,
    '87': 340,
    '37': 350,
    '86': 360,
    '36': 370,
    '85': 380,
    '35': 390,
    '84': 400,
    '34': 410,
    '83': 420,
    '33': 430,
    '82': 440,
    '32': 450,
    '81': 460,
    '31': 470,
    '80': 480,
    '30': 490,
    '79': 500,
    '29': 510,
    '78': 520,
    '28': 530,
    '77': 540,
    '27': 550,
    // Current & Recent Plates
    '76': 560,  // Sept 2026 (Coming Soon)
    '26': 570,  // Mar 2026 (Current)
    '75': 580,  // Sept 2025
    '25': 590,  // Mar 2025
    '74': 600,  // Sept 2024
    '24': 610,  // Mar 2024
    '73': 620,  // Sept 2023
    '23': 630,  // Mar 2023
    '72': 640,
    '22': 650,
    '71': 660,
    '21': 670,
    '70': 680,
    '20': 690,
    '69': 700,
    '19': 710,
    '68': 720,
    '18': 730,
    '67': 740,
    '17': 750,
    '66': 760,
    '16': 770,
    '65': 780,
    '15': 790,
    '64': 800,
    '14': 810,
    '63': 820,
    '13': 830,
    '62': 840,
    '12': 850,
    '61': 860,
    '11': 870,
    '60': 880,
    '10': 890,
    '59': 900,
    '09': 910,
    '58': 920,
    '08': 930,
    '57': 940,
    '07': 950,
    '56': 960,
    '06': 970,
    '55': 980,
    '05': 990,
    '54': 1000,
    '04': 1010,
    '53': 1020,
    '03': 1030,
    '52': 1040,
    '02': 1050, // Mar 2002
    '51': 1060, // Sept 2001 (Start of System)
    '01': 1070, // Theoretical floor
};

// First 2 letters
export enum CurrentRegMemoryTag {
    MR = 5000,
    YO = 1000,
    MY = 500,
    BE = 250,
    GO = 250,
}

export enum CurrentRegMemoryTagAndAgeIdentifier {
    // --- The "SS" / "S" Series (Age 55, 05, 15) ---
    BO55 = 2000, // BOSS
    BA55 = 1000, // BASS
    GA55 = 1000, // GASS
    LE55 = 1000, // LESS
    MA55 = 1000, // MASS
    PA55 = 1000, // PASS
    RO55 = 1000, // ROSS
    ME55 = 1000, // MESS
    AM15 = 1000, // AMIS
    MY05 = 1000, // MYOS

    // --- The "ST" Series (Age 57) ---
    FA57 = 3000, // FAST
    LA57 = 1000, // LAST
    BE57 = 2000, // BEST
    WE57 = 1000, // WEST
    PO57 = 1000, // POST
    HO57 = 1000, // HOST
    CO57 = 1000, // COST

    // --- The "SE" / "E" Series (Age 53, 03, 33) ---
    RO53 = 1000, // ROSE
    CA53 = 1000, // CASE
    BA53 = 1000, // BASE
    EL53 = 1000, // ELSE
    HO53 = 1000, // HOSE
    BE33 = 1000, // BEEE (Beer/Beef)
    FR33 = 1000, // FREE

    // --- The "LL" / "L" / "I" Series (Age 11, 01, 21) ---
    BA11 = 1000, // BALL
    HA11 = 1000, // HALL
    HE11 = 1500, // HELL
    PA11 = 1000, // PALL
    WE11 = 1000, // WELL
    FI11 = 1000, // FILL
    MA11 = 1000, // MAIL
    GA11 = 1000, // GALL

    // --- The "A" / "OR" / "ER" Series (Age 04, 02, 51) ---
    LA04 = 1000, // LADY (if suffix is DY)
    RE04 = 1000, // REAR
    BA02 = 1000, // BAR (if suffix starts with R)
    MR51 = 1000, // MRSI (Mr Singh)
    
    // --- Manual Overrides / Popular Requests ---
    TH15 = 2000, // THIS (Note: TH is not a standard Region Tag)
    GO55 = 1000, // GOSS
    HU63 = 1000, // HUGE
}

export enum CurrentRegAgeIdentifierAndSMRLetters {
    _51NGH = 10000,
}



// Plate Alphabet (the numbers that look most like letters):
// 1 = I (or L)
// 3 = E
// 4 = A
// 5 = S
// 6 = G
// 7 = T
// 8 = B or R (stylized)
// 0 = O

export const PLATE_ALPHABET: Record<string, string[]> = {
  '0': ['O'],
  '1': ['I', 'L'],
  '3': ['E'],
  '4': ['A'],
  '5': ['S'],
  '6': ['G'],
  '7': ['T'],
  '8': ['B', 'R'],
};

export const AGE_IDENTIFIER_MATCH = 1000;
export const AGE_IDENTIFIER_NO_MATCH = -100;

export const ONE_WORD_DICTIONARY_MATCH = 5000;
export const ONE_WORD_DICTIONARY_NO_MATCH = 1000;

export const DICTIONARY_WORD_BONUS = 3000;
export const TWO_WORD_LEGAL_SPACING_BONUS = 3000;
export const NON_LEGAL_SPACING_PENALTY = -1000;
export const THREE_WORD_PENALTY = -5000;

export const FIRST_CHAR_X_BONUS = 500;
export const FIRST_CHAR_NOT_X_PENALTY = -250;

// Dictionary match/no-match bonuses keyed by word length — used for all 2-word spacing combinations
export const WORD_DICT_MATCH_BONUS: Record<number, number> = {
  2: 2000,
  3: 1500,
  4: 2000,
  5: 3000,
  6: 3000,
};
export const WORD_DICT_NO_MATCH_PENALTY: Record<number, number> = {
  2: -1000,
  3: -500,
  4: -500,
  5: -1000,
  6: -500,
};

// Weighted popular surnames — higher value = higher plate demand
// Decoded plate characters (e.g. 51NGH → SINGH) are checked against this list
export const POPULAR_SURNAMES: Record<string, number> = {
  // High demand — South Asian communities
  SINGH:  8000,
  KAUR:   7000,
  GILL:   6000,
  PATEL:  6000,
  KHAN:   6000,
  SHAH:   5000,
  AHMED:  5000,
  AKHTAR: 5000,
  HUSSAIN:5000,
  MALIK:  4500,
  RAHMAN: 4500,
  BEGUM:  4000,
  IQBAL:  4000,
  CHANA:  4000,
  DHESI:  4000,
  BHATT:  4000,
  BAINS:  4000,
  SOHAL:  4000,
  GREWAL: 4000,
  SANDHU: 4000,
  DHALIWAL: 4000,

  // High demand — common UK surnames
  SMITH:  3000,
  JONES:  3000,
  BROWN:  3000,
  TAYLOR: 3000,
  WILSON: 3000,
  DAVIES: 3000,
  EVANS:  3000,
  THOMAS: 3000,
  WHITE:  3000,
  HARRIS: 3000,
  MARTIN: 3000,
  WALKER: 3000,
  ALLEN:  3000,
  YOUNG:  3000,
  KING:   3500,
  BALL:   3000,
  BELL:   3000,
  HALL:   3000,
  HILL:   3000,
  COLE:   3000,
  FORD:   3000,
  ROSS:   3000,
  BASS:   3000,
  BEST:   3500,
  BOSS:   3500,
};

export const SURNAME_BONUS_NO_MATCH = 0;

// Special full-plate combinations — prefix + surname pairings with high cultural demand
export const SPECIAL_COMBINATIONS: Record<string, number> = {
  MRSINGH:  1000000,
  DRSINGH:  1000000,
  MRSKAUR:  1000000,
  MRKHAN:   750000,
  DRKHAN:   750000,
  MRPATEL:  750000,
  DRPATEL:  750000,
  MRSGILL:  500000,
  MRGILL:   500000,
  DRGILL:   500000,
  JUSTEAT:  500000,
};

// Popular first names by length — checked against each word in a 2-word spacing combination
export const POPULAR_NAMES: Record<string, number> = {
  // 3-letter names
  JON: 500, DAN: 500, BEN: 500, TOM: 500, ROB: 500, SAM: 500,
  KIM: 500, AMY: 500, ZOE: 500, IAN: 500, MAX: 500, LEE: 500,
  RAY: 500, JAY: 500, KAY: 500, PAM: 500, SUE: 500, BOB: 500,
  JIM: 500, TIM: 500, RON: 500, DON: 500, ANN: 500, EVE: 500,
  GUY: 500, KEN: 500, REX: 500, ROY: 500, DEE: 500, ELI: 500,
  ALI: 500, JAZ: 500, NAZ: 500, RAJ: 500, VIC: 500, SID: 500,
  NYA: 500, MIA: 500, ANA: 500, IDA: 500, UMA: 500, AVA: 500,
  NIA: 500, KAI: 500, RIO: 500, RAE: 500, SKY: 500, DEV: 500,
  PAT: 500, MAT: 500, NAT: 500, CAT: 500, JOY: 500, ROZ: 500,
  TAJ: 500, ZAK: 500, JAD: 500, MAZ: 500, TAZ: 500, BAZ: 500,
  // 4-letter names
  JOHN: 1000, JACK: 1000, JAKE: 1000, ADAM: 1000, ALEX: 1000,
  RYAN: 1000, SEAN: 1000, EMMA: 1000, ANNA: 1000, KATE: 1000,
  JANE: 1000, LUCY: 1000, SARA: 1000, LISA: 1000, MARK: 1000,
  PAUL: 1000, DAVE: 1000, GARY: 1000, NEIL: 1000, ALAN: 1000,
  GLEN: 1000, TONY: 1000, ANDY: 1000, DEAN: 1000, KYLE: 1000,
  LIAM: 1000, NOAH: 1000, OMAR: 1000, RAVI: 1000, AMIR: 1000,
  JESS: 1000, BETH: 1000, RUTH: 1000, DAWN: 1000, ROSE: 1000,
  JADE: 1000, LEAH: 1000, MAYA: 1000, NINA: 1000, TARA: 1000,
  RHYS: 1000, ZARA: 1000, SANA: 1000, HANA: 1000, RANI: 1000,
  // 5-letter names
  JAMES: 1500, DAVID: 1500, PETER: 1500, SIMON: 1500, SCOTT: 1500,
  JASON: 1500, AARON: 1500, EMILY: 1500, SARAH: 1500, LAURA: 1500,
  HELEN: 1500, KAREN: 1500, DONNA: 1500, HARRY: 1500, BARRY: 1500,
  TERRY: 1500, KERRY: 1500, LEROY: 1500, JERRY: 1500, PERRY: 1500,
  BOBBY: 1500, TOMMY: 1500, JIMMY: 1500, JONNY: 1500, DANNY: 1500,
  NADIA: 1500, SOFIA: 1500, LAYLA: 1500, PRIYA: 1500, AMIRA: 1500,
  ALFIE: 1500, OLLIE: 1500, LOUIE: 1500, OZZIE: 1500, RONNIE: 1500,
  // 6-letter names
  GEORGE: 2000, DANIEL: 2000, ROBERT: 2000, THOMAS: 2000, JOSEPH: 2000,
  STEVEN: 2000, ANDREW: 2000, RACHEL: 2000, HANNAH: 2000, NICOLA: 2000,
  AMANDA: 2000, DEBBIE: 2000, JUSTIN: 2000, TREVOR: 2000, GRAHAM: 2000,
  OLIVER: 2000, JOSHUA: 2000, SAMUEL: 2000, NATHAN: 2000, MARCUS: 2000,
  HASSAN: 2000, FARHAN: 2000, TARIQ: 2000, USMAN: 2000, KHALID: 2000,
  FATIMA: 2000, AISHA: 2000, ZAINAB: 2000, YASMIN: 2000, SHABNAM: 2000,
  // 7-letter names
  MICHAEL: 2500, STEPHEN: 2500, MATTHEW: 2500, RICHARD: 2500, WILLIAM: 2500,
  JESSICA: 2500, NATALIE: 2500, REBECCA: 2500, THERESA: 2500, BARBARA: 2500,
  PHILLIP: 2500, DOMINIC: 2500, CAMERON: 2500, BRENDAN: 2500, PATRICK: 2500,
  ANTONIA: 2500, SABRINA: 2500, JASMINE: 2500, SHANNON: 2500, CAROLYN: 2500,
};

export const VALID_TWO_LETTER_COMBINATIONS: Record<string, number> = {
  MR: 2000,
  MRS: 2000,
  MS: 2000,
  DR: 2000,
  ST: 2000,
  GO: 2000,
  BE: 2000,
  MY: 2000,
  IT: 2000,
  NO: 2000,
  OK: 2000,
};