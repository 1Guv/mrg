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
