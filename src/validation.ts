import { allFields, type SurveyField } from './survey';
import type { SurveyAnswers } from './storage';

export interface SurveyProblem {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

const conditionalFields: Record<string, (data: SurveyAnswers) => boolean> = {
  storage_condition: data => data.storage_available === 'Yes',
  storage_photo: data => data.storage_available === 'Yes',
  last_rehabilitation: data => Number(data.rehabilitation_count ?? 0) > 0,
  rehabilitated_by: data => Number(data.rehabilitation_count ?? 0) > 0,
  saving_photo: data => data.saving_mechanisms === 'Yes',
  waterlogging_photo: data => data.waterlogging === 'Yes',
  weather_station_photo: data => data.weather_station === 'Yes',
  weather_station_gps: data => data.weather_station === 'Yes',
  weather_instruments: data => data.weather_station === 'Yes',
};

export function isFieldVisible(field: SurveyField, data: SurveyAnswers): boolean {
  const condition = conditionalFields[field.key];
  return condition ? condition(data) : true;
}

function supplied(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' ? value.trim() !== '' : true;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (String(value).trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Drafts may be incomplete. Submission validation is intentionally stricter.
 * The server must perform the same checks again before any acceptance.
 */
export function validateBaseline(data: SurveyAnswers, submit: boolean): SurveyProblem[] {
  const problems: SurveyProblem[] = [];
  const add = (field: string, severity: SurveyProblem['severity'], message: string) =>
    problems.push({ field, severity, message });

  for (const field of allFields) {
    if (!isFieldVisible(field, data)) continue;
    const value = data[field.key];
    if (submit && field.required && !supplied(value)) {
      add(field.key, 'error', field.label + ' is required.');
    }
    if (!supplied(value)) continue;

    if (field.type === 'number') {
      const number = numberOrUndefined(value);
      if (number === undefined || number < 0) {
        add(field.key, 'error', field.label + ' must be a non-negative number.');
      } else if (field.key === 'commissioned_year' &&
          (number < 1900 || number > new Date().getFullYear() || !Number.isInteger(number))) {
        add(field.key, 'error', 'Year of commissioning must be a whole year between 1900 and the current year.');
      } else if (['beneficiaries','rehabilitation_count'].includes(field.key) && !Number.isInteger(number)) {
        add(field.key, 'error', field.label + ' must be a whole number.');
      }
    }

    if (field.type === 'gps') {
      const point = value as { latitude?: unknown; longitude?: unknown; accuracy_m?: unknown };
      const lat = Number(point?.latitude);
      const lon = Number(point?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
          lat < -22.5 || lat > -15.5 || lon < 25.2 || lon > 33.1) {
        add(field.key, 'error', 'GPS point is outside the approximate Zimbabwe bounds (WGS84).');
      } else if (Number(point.accuracy_m) > 20) {
        add(field.key, 'warning', 'GPS accuracy is poorer than 20 metres. Retake or provide a reason.');
      }
    }

    if (field.options && field.type === 'select' && !field.options.includes(String(value))) {
      add(field.key, 'error', 'Select a listed option for ' + field.label + '.');
    }
    if (field.options && field.type === 'multi' &&
        (!Array.isArray(value) || value.some(option => !field.options!.includes(String(option))))) {
      add(field.key, 'error', 'One or more choices for ' + field.label + ' are not permitted.');
    }
  }

  if (submit) {
    for (const [field, requiredIf] of [
      ['saving_photo', 'saving_mechanisms'],
      ['waterlogging_photo', 'waterlogging'],
      ['weather_station_photo', 'weather_station'],
    ]) {
      if (data[requiredIf] === 'Yes' && !supplied(data[field])) {
        add(field, 'error', 'A photograph is required when the answer is Yes.');
      }
    }
  }

  const equipped = numberOrUndefined(data.equipped_area_ha);
  const functional = numberOrUndefined(data.functional_area_ha);
  if (equipped !== undefined && functional !== undefined && functional > equipped) {
    add('functional_area_ha', 'warning', 'Functional area is larger than equipped area; explain the discrepancy before verification.');
  }
  if (data.scheme_status === 'Fully functional' &&
      equipped !== undefined && functional !== undefined && functional < equipped) {
    add('scheme_status', 'warning', 'Fully functional status does not agree with the reported functional area.');
  }
  return problems;
}
