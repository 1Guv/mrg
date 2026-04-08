"use strict";
// Points between 700 - 1000
// Dateless points start at 700
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinMaxTotals = exports.IsPlateSpacingGoodForMot = exports.IsAnyNumberUsedAsLetter = exports.IsAnyLetterUsedAsNumber = exports.Total = exports.Spaces = exports.DigitValues = exports.LetterValues = exports.DatelessHowManyLettersMultiplier = exports.DatelessHowManyNumbersMultiplier = exports.DatelessYearMultiplier = exports.DatelessRegMultiplier = exports.DatelessRegLength = exports.DatelessReg = void 0;
var DatelessReg;
(function (DatelessReg) {
    DatelessReg[DatelessReg["start"] = 700] = "start";
    DatelessReg[DatelessReg["letterFirst"] = 1000] = "letterFirst";
    DatelessReg[DatelessReg["numberFirst"] = 250] = "numberFirst";
})(DatelessReg || (exports.DatelessReg = DatelessReg = {}));
var DatelessRegLength;
(function (DatelessRegLength) {
    DatelessRegLength[DatelessRegLength["_6"] = 100] = "_6";
    DatelessRegLength[DatelessRegLength["_5"] = 300] = "_5";
    DatelessRegLength[DatelessRegLength["_4"] = 600] = "_4";
    DatelessRegLength[DatelessRegLength["_3"] = 800] = "_3";
    DatelessRegLength[DatelessRegLength["_2"] = 1000] = "_2";
})(DatelessRegLength || (exports.DatelessRegLength = DatelessRegLength = {}));
var DatelessRegMultiplier;
(function (DatelessRegMultiplier) {
    DatelessRegMultiplier[DatelessRegMultiplier["_6"] = 3] = "_6";
    DatelessRegMultiplier[DatelessRegMultiplier["_5"] = 6] = "_5";
    DatelessRegMultiplier[DatelessRegMultiplier["_4"] = 8] = "_4";
    DatelessRegMultiplier[DatelessRegMultiplier["_3"] = 10] = "_3";
    DatelessRegMultiplier[DatelessRegMultiplier["_2"] = 25] = "_2";
})(DatelessRegMultiplier || (exports.DatelessRegMultiplier = DatelessRegMultiplier = {}));
var DatelessYearMultiplier;
(function (DatelessYearMultiplier) {
    DatelessYearMultiplier[DatelessYearMultiplier["_6"] = 50] = "_6";
    DatelessYearMultiplier[DatelessYearMultiplier["_5"] = 200] = "_5";
    DatelessYearMultiplier[DatelessYearMultiplier["_4"] = 300] = "_4";
    DatelessYearMultiplier[DatelessYearMultiplier["_3"] = 500] = "_3";
    DatelessYearMultiplier[DatelessYearMultiplier["_2"] = 1000] = "_2";
})(DatelessYearMultiplier || (exports.DatelessYearMultiplier = DatelessYearMultiplier = {}));
var DatelessHowManyNumbersMultiplier;
(function (DatelessHowManyNumbersMultiplier) {
    DatelessHowManyNumbersMultiplier[DatelessHowManyNumbersMultiplier["_1"] = 10000] = "_1";
    DatelessHowManyNumbersMultiplier[DatelessHowManyNumbersMultiplier["_2"] = 1000] = "_2";
    DatelessHowManyNumbersMultiplier[DatelessHowManyNumbersMultiplier["_3"] = 300] = "_3";
    DatelessHowManyNumbersMultiplier[DatelessHowManyNumbersMultiplier["_4"] = 250] = "_4";
})(DatelessHowManyNumbersMultiplier || (exports.DatelessHowManyNumbersMultiplier = DatelessHowManyNumbersMultiplier = {}));
var DatelessHowManyLettersMultiplier;
(function (DatelessHowManyLettersMultiplier) {
    DatelessHowManyLettersMultiplier[DatelessHowManyLettersMultiplier["_1"] = 10000] = "_1";
    DatelessHowManyLettersMultiplier[DatelessHowManyLettersMultiplier["_2"] = 1000] = "_2";
    DatelessHowManyLettersMultiplier[DatelessHowManyLettersMultiplier["_3"] = 300] = "_3";
})(DatelessHowManyLettersMultiplier || (exports.DatelessHowManyLettersMultiplier = DatelessHowManyLettersMultiplier = {}));
var LetterValues;
(function (LetterValues) {
    LetterValues[LetterValues["A"] = 70] = "A";
    LetterValues[LetterValues["B"] = 70] = "B";
    LetterValues[LetterValues["C"] = 40] = "C";
    LetterValues[LetterValues["D"] = 30] = "D";
    LetterValues[LetterValues["E"] = 50] = "E";
    LetterValues[LetterValues["F"] = 50] = "F";
    LetterValues[LetterValues["G"] = 60] = "G";
    LetterValues[LetterValues["H"] = 40] = "H";
    LetterValues[LetterValues["J"] = 40] = "J";
    LetterValues[LetterValues["K"] = 30] = "K";
    LetterValues[LetterValues["L"] = 40] = "L";
    LetterValues[LetterValues["M"] = 50] = "M";
    LetterValues[LetterValues["N"] = 40] = "N";
    LetterValues[LetterValues["O"] = 50] = "O";
    LetterValues[LetterValues["P"] = 40] = "P";
    LetterValues[LetterValues["R"] = 50] = "R";
    LetterValues[LetterValues["S"] = 80] = "S";
    LetterValues[LetterValues["T"] = 50] = "T";
    LetterValues[LetterValues["U"] = 40] = "U";
    LetterValues[LetterValues["V"] = 30] = "V";
    LetterValues[LetterValues["W"] = 40] = "W";
    LetterValues[LetterValues["X"] = 50] = "X";
    LetterValues[LetterValues["Y"] = 30] = "Y";
    LetterValues[LetterValues["Z"] = 20] = "Z";
})(LetterValues || (exports.LetterValues = LetterValues = {}));
var DigitValues;
(function (DigitValues) {
    DigitValues[DigitValues["_0"] = 50] = "_0";
    DigitValues[DigitValues["_1"] = 100] = "_1";
    DigitValues[DigitValues["_2"] = 90] = "_2";
    DigitValues[DigitValues["_3"] = 70] = "_3";
    DigitValues[DigitValues["_4"] = 60] = "_4";
    DigitValues[DigitValues["_5"] = 80] = "_5";
    DigitValues[DigitValues["_6"] = 60] = "_6";
    DigitValues[DigitValues["_7"] = 40] = "_7";
    DigitValues[DigitValues["_8"] = 80] = "_8";
    DigitValues[DigitValues["_9"] = 40] = "_9";
})(DigitValues || (exports.DigitValues = DigitValues = {}));
var Spaces;
(function (Spaces) {
    Spaces[Spaces["_0"] = 1000] = "_0";
    Spaces[Spaces["_1"] = 800] = "_1";
    Spaces[Spaces["_2"] = -800] = "_2";
    Spaces[Spaces["_3"] = -1000] = "_3";
})(Spaces || (exports.Spaces = Spaces = {}));
var Total;
(function (Total) {
    Total[Total["min"] = -50] = "min";
    Total[Total["max"] = 30] = "max";
})(Total || (exports.Total = Total = {}));
var IsAnyLetterUsedAsNumber;
(function (IsAnyLetterUsedAsNumber) {
    IsAnyLetterUsedAsNumber[IsAnyLetterUsedAsNumber["_true"] = -1000] = "_true";
    IsAnyLetterUsedAsNumber[IsAnyLetterUsedAsNumber["_false"] = 0] = "_false";
})(IsAnyLetterUsedAsNumber || (exports.IsAnyLetterUsedAsNumber = IsAnyLetterUsedAsNumber = {}));
var IsAnyNumberUsedAsLetter;
(function (IsAnyNumberUsedAsLetter) {
    IsAnyNumberUsedAsLetter[IsAnyNumberUsedAsLetter["_true"] = -1000] = "_true";
    IsAnyNumberUsedAsLetter[IsAnyNumberUsedAsLetter["_false"] = 0] = "_false";
})(IsAnyNumberUsedAsLetter || (exports.IsAnyNumberUsedAsLetter = IsAnyNumberUsedAsLetter = {}));
var IsPlateSpacingGoodForMot;
(function (IsPlateSpacingGoodForMot) {
    IsPlateSpacingGoodForMot[IsPlateSpacingGoodForMot["_true"] = -2000] = "_true";
    IsPlateSpacingGoodForMot[IsPlateSpacingGoodForMot["_false"] = 0] = "_false";
})(IsPlateSpacingGoodForMot || (exports.IsPlateSpacingGoodForMot = IsPlateSpacingGoodForMot = {}));
var MinMaxTotals;
(function (MinMaxTotals) {
    MinMaxTotals[MinMaxTotals["min"] = 0.5] = "min";
    MinMaxTotals[MinMaxTotals["max"] = 0.3] = "max";
})(MinMaxTotals || (exports.MinMaxTotals = MinMaxTotals = {}));
//# sourceMappingURL=dateless-formula.js.map