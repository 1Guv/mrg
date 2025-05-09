import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function regPatternValidator(
    pattern: RegExp,
    errorKey: string,
    errorMessage: string
  ): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
  
      if (!value || pattern.test(value)) {
        return null;
      }
  
      return {
        [errorKey]: {
          message: errorMessage,
        },
      };
    };
  }
