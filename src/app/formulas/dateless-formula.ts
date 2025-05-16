// Points between 700 - 1000
// Dateless points start at 700

export enum DatelessReg {
    start = 700,
    letterFirst = 1000,
    numberFirst = 250
}

export enum DatelessRegLength {
    _6 = 100,
    _5 = 300,
    _4 = 600,
    _3 = 800,
    _2 = 1000
}

export enum DatelessRegMultiplier {
    _6 = 3,
    _5 = 6,
    _4 = 10,
    _3 = 25,
    _2 = 100
}

export enum LetterValues {
    A = 70,
    B = 70,
    C = 40,
    D = 30,
    E = 50,
    F = 50,
    G = 60,
    H = 40,
    J = 40,
    K = 30,
    L = 40,
    M = 50,
    N = 40,
    O = 50,
    P = 40,
    R = 50,
    S = 80,
    T = 50,
    U = 40,
    V = 30,
    W = 40,
    X = 50,
    Y = 30,
    Z = 20,
}

export enum DigitValues {
    _0 = 50,
    _1 = 100,
    _2 = 90,
    _3 = 70,
    _4 = 60,
    _5 = 80,
    _6 = 60,
    _7 = 40,
    _8 = 80,
    _9 = 40,
}
  
export enum Spaces {
    _0 = 1000,
    _1 = 800,
    _2 = -800,
    _3 = -1000
}

export enum Total {
    min = -50,
    max = 30
}

export enum IsAnyLetterUsedAsNumber {
    _true = -500,
    _false = 0
}

export enum IsAnyNumberUsedAsLetter {
    _true = -500,
    _false = 0
}

export enum MinMaxTotals {
    min = 0.5,
    max = 0.3
}
