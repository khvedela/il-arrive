import { Injectable } from '@nestjs/common';
import { InterventionStatus } from '@il-arrive/contracts';

export interface SmsTemplateParams {
  businessName: string;
  technicianFirstName: string;
  eta?: Date;
  trackingLink: string;
  interventionAddress?: string;
  delayMinutes?: number;
}

export interface SmsTemplateResult {
  body: string;
  length: number;
  gsm7Safe: boolean;
  warning?: string;
}

@Injectable()
export class SmsTemplatesService {
  private static readonly GSM7alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 @#$%%&\'()*+,-./:;<=>?¡¿!\\"#%&\'()*+,-./:;<=>?ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ';
  private static readonly GSM7extension = '\n\r\b\r\f\b\b\b\b\b\b\b\b';

  getTemplate(kind: InterventionStatus | string, params: SmsTemplateParams): SmsTemplateResult {
    const { businessName, technicianFirstName, eta, trackingLink, interventionAddress, delayMinutes } = params;

    let body = '';

    switch (kind) {
      case 'EN_ROUTE': {
        const etaTime = eta ? this.formatEta(eta) : 'bientôt';
        body = `${technicianFirstName} (${businessName}) est en route. Arrivée estimée vers ${etaTime}. Suivi : ${trackingLink}`;
        break;
      }

      case 'CONFIRMATION': {
        body = `Votre intervention est confirmée. ${businessName} vous contactera à ${interventionAddress}. Suivi : ${trackingLink}`;
        break;
      }

      case 'DELAY': {
        const etaTime = eta ? this.formatEta(eta) : 'bientôt';
        const delayText = delayMinutes ? ` retard de ${delayMinutes} min` : '';
        body = `Retard signalé sur votre intervention.${delayText} Nouvelle ETA : vers ${etaTime}. Suivi : ${trackingLink}`;
        break;
      }

      case 'ARRIVED': {
        body = `${technicianFirstName} est arrivé. Intervention en cours. Suivi : ${trackingLink}`;
        break;
      }

      case 'CANCELLED': {
        body = `Votre intervention a été annulée. ${businessName} vous contactera au besoin. Suivi : ${trackingLink}`;
        break;
      }

      case 'RESCHEDULED': {
        body = `Votre rendez-vous a été déplacé. Nouveau créneau disponible. Contactez ${businessName} pour plus d'infos. Suivi : ${trackingLink}`;
        break;
      }

      case 'ETA_UPDATE': {
        const etaTime = eta ? this.formatEta(eta) : 'bientôt';
        body = `Mise à jour ETA : vers ${etaTime}. ${technicianFirstName} (${businessName}) est en route. Suivi : ${trackingLink}`;
        break;
      }

      default: {
        body = `Vous avez une nouvelle notification de ${businessName}. Voir: ${trackingLink}`;
      }
    }

    return this.finalizeSms(body, businessName, trackingLink);
  }

  private formatEta(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}h${minutes}`;
  }

  private finalizeSms(body: string, businessName: string, trackingLink: string): SmsTemplateResult {
    const length = this.countGsm7Chars(body);

    const gsm7Safe = this.isGsm7Safe(body);
    const warning = !gsm7Safe
      ? 'Warning: Contains non-GSM-7 characters. May be converted to Unicode (cost: 160→70 chars).'
      : undefined;

    return {
      body,
      length,
      gsm7Safe,
      warning,
    };
  }

  private countGsm7Chars(text: string): number {
    let count = 0;
    for (const char of text) {
      if (SmsTemplatesService.GSM7alphabet.includes(char)) {
        count++;
      } else if (SmsTemplatesService.GSM7extension.includes(char)) {
        count += 2;
      } else {
        count += 2;
      }
    }
    return count;
  }

  private isGsm7Safe(text: string): boolean {
    for (const char of text) {
      if (!SmsTemplatesService.GSM7alphabet.includes(char) && !SmsTemplatesService.GSM7extension.includes(char)) {
        return false;
      }
    }
    return true;
  }
}
