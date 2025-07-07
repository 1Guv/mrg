export interface Badge {
  code: string;
  label: string;
  icon: string;
}

export enum NumberPlateType {
    Current = 'current',
    Prefix = 'prefix',
    Suffix = 'suffix',
    Dateless = 'dateless'
}

export enum NumberPlateTypeExamples {
    currentEg = 'FA57 CAR' ,
    prefixEg = 'F457 CAR' ,
    suffixEg = 'FAS 73R' ,
    datelessEg = 'FAS 7' 
}

export interface NumberPlateTypeObj {
    value: NumberPlateType;
    example: NumberPlateTypeExamples;
}

export interface RegValuation {
    id?: string;
    type?: NumberPlateType;
    registration?: string;
    badge?: Badge;
    frontBack?: boolean;
    plateTypePoints?: number;
    howManyNumbersPoints?: number;
    howManyLettersPoints?: number;
    plateLengthPoints?: number;
    plateFirstCharacterPoints?: number;
    plateCharacterPoints?: number;
    charPoints?: Array<{ character: string, points: number }>;
    spacesSelected?: number;
    spacesPoints?: number;
    isAnyLetterUsedAsNumberPoints?: number;
    isAnyNumberUsedAsLetterPoints?: number;
    isDateOfPurchaseKnownPoints?: number;
    isPlateSpacingGoodForMotPoints?: number;
    isPlateSpacingGoodForMot?: boolean;
    isAnyLetterUsedAsNumber?: boolean;
    isAnyNumberUsedAsLetter?: boolean;
    isDateOfPurchaseKnown?: boolean;
    isDateOfPurchaseKnownToggle?: boolean;
    dateOfPurchaseKnownPoints?: number;
    yearsOld?: number;
    dateOfPurchaseMultiplierPoints?: number;
    multiplier?: number;
    totalPoints?: number;
    totalPointsWithMultiplier?: number;
    minPrice?: number;
    maxPrice?: number;
    popularityMultiplier?: number;
    totalPointsWithPopularityMultiplier?: number;
    minMultiplier?: number;
    maxMultiplier?: number;
    userId?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
