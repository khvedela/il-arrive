import { Injectable } from '@nestjs/common';
import * as libphonenumber from 'libphonenumber-js';

export interface PhoneNumberResult {
  formatted: string;
  national: string;
  international: string;
  e164: string;
  isValid: boolean;
  region: string;
}

@Injectable()
export class PhoneFormatterService {
  private static readonly DEFAULT_REGION = 'FR';

  parseAndFormat(phone: string, region: string = PhoneFormatterService.DEFAULT_REGION): PhoneNumberResult {
    let phoneNumber;
    try {
      phoneNumber = libphonenumber.parse(phone, region);
    } catch (error) {
      return {
        formatted: phone,
        national: phone,
        international: phone,
        e164: phone,
        isValid: false,
        region: region,
      };
    }

    const isValid = libphonenumber.isValid(phoneNumber);

    return {
      formatted: isValid ? libphonenumber.format(phoneNumber, 'National') : phone,
      national: isValid ? libphonenumber.format(phoneNumber, 'National') : phone,
      international: isValid ? libphonenumber.format(phoneNumber, 'International') : phone,
      e164: isValid ? libphonenumber.format(phoneNumber, 'E.164') : phone,
      isValid,
      region: phoneNumber?.country || region,
    };
  }

  parse(phone: string, region: string = PhoneFormatterService.DEFAULT_REGION): libphonenumber.PhoneNumber | null {
    try {
      const phoneNumber = libphonenumber.parse(phone, region);
      if (libphonenumber.isValid(phoneNumber)) {
        return phoneNumber;
      }
      return null;
    } catch {
      return null;
    }
  }

  findCountryCodeByRegion(region: string): string | undefined {
    try {
      const example = libphonenumber.getExampleNumber(region);
      return example?.getCountryCode();
    } catch {
      return undefined;
    }
  }
}
