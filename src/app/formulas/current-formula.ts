// Current points start at 100

export enum CurrentReg {
    start = 100
}

export enum CurrentRegLength {
    _7 = 0
}

export enum CurrentRegMultiplier {
    _7 = 1
}

export enum CurrentRegYearMultiplier {
    // Future Plates
    _99 = 1000, // Sept 2049
    _49 = 1100, // Mar 2049
    _98 = 1200, // Sept 2048
    _48 = 1300, // Mar 2048
    _97 = 1400, // Sept 2047
    _47 = 1500, // Mar 2047
    _96 = 1600, // Sept 2046
    _46 = 1700, // Mar 2046
    _95 = 1800, // Sept 2045
    _45 = 1900, // Mar 2045
    _94 = 2000,
    _44 = 2100,
    _93 = 2200,
    _43 = 2300,
    _92 = 2400,
    _42 = 2500,
    _91 = 2600,
    _41 = 2700,
    _90 = 2800,
    _40 = 2900,
    _89 = 3000,
    _39 = 3100,
    _88 = 3200,
    _38 = 3300,
    _87 = 3400,
    _37 = 3500,
    _86 = 3600,
    _36 = 3700,
    _85 = 3800,
    _35 = 3900,
    _84 = 4000,
    _34 = 4100,
    _83 = 4200,
    _33 = 4300,
    _82 = 4400,
    _32 = 4500,
    _81 = 4600,
    _31 = 4700,
    _80 = 4800,
    _30 = 4900,
    _79 = 5000,
    _29 = 5100,
    _78 = 5200,
    _28 = 5300,
    _77 = 5400,
    _27 = 5500,
    // Current & Recent Plates
    _76 = 5600, // Sept 2026 (Coming Soon)
    _26 = 5700, // Mar 2026 (Current)
    _75 = 5800, // Sept 2025
    _25 = 5900, // Mar 2025
    _74 = 6000, // Sept 2024
    _24 = 6100, // Mar 2024
    _73 = 6200, // Sept 2023
    _23 = 6300, // Mar 2023
    _72 = 6400,
    _22 = 6500,
    _71 = 6600,
    _21 = 6700,
    _70 = 6800,
    _20 = 6900,
    _69 = 7000,
    _19 = 7100,
    _68 = 7200,
    _18 = 7300,
    _67 = 7400,
    _17 = 7500,
    _66 = 7600,
    _16 = 7700,
    _65 = 7800,
    _15 = 7900,
    _64 = 8000,
    _14 = 8100,
    _63 = 8200,
    _13 = 8300,
    _62 = 8400,
    _12 = 8500,
    _61 = 8600,
    _11 = 8700,
    _60 = 8800,
    _10 = 8900,
    _59 = 9000,
    _09 = 9100,
    _58 = 9200,
    _08 = 9300,
    _57 = 9400,
    _07 = 9500,
    _56 = 9600,
    _06 = 9700,
    _55 = 9800,
    _05 = 9900,
    _54 = 10000,
    _04 = 10100,
    _53 = 10200,
    _03 = 10300,
    _52 = 10400,
    _02 = 10500, // Mar 2002
    _51 = 10600, // Sept 2001 (Start of System)
    _01 = 10700  // Theoretical floor
}

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
// 2 = Z (or R)
// 3 = E
// 4 = A
// 5 = S
// 6 = G (or B)
// 7 = T
// 8 = B
// 0 = O