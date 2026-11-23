import type { SurveyAnswers } from './storage';

export type ValidationIssue = {
  key: string;
  severity: 'error' | 'warning';
  message: string;
};

/** Drafts may be incomplete. Use these checks before a future authenticated submit. */
export function validateBaseline(answers: SurveyAnswers, year = new Date().getFullYear()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const text = (key: string) => {
    const value = answers[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const numeric = (key: string) => {
    const value = answers[key];
    if (value === null || value === undefined || value === '') return undefined;
    const result = Number(value);
    return Number.isFinite(result) ? result : NaN;
  };
  const error = (key: string, message: string) => issues.push({ key, severity: 'error' as const, message });
  const warn = (key: string, message: string) => issues.push({ key, severity: 'warning' as const, message });

  for (const [key, label] of [
    ['site_name', 'Site name'], ['scheme_name', 'Scheme name'],
    ['province', 'Province'], ['district', 'District']
  ] as const) {
    if (!text(key)) error(key, label + ' is required before submission.');
  }

  if (!text('scheme_photo')) error('scheme_photo', 'Please attach a scheme photograph before submission.');
  if (!answers.scheme_gps) error('scheme_gps', 'Please capture the scheme gate coordinates before submission.');

  for (const key of ['equipped_area_ha', 'expansion_area_ha', 'functional_area_ha', 'plot_size_ha', 'beneficiaries', 'commissioned_year', 'rehabilitation_count']) {
    const value = numeric(key);
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) error(key, 'Enter a valid non-negative number.');
    if (['beneficiaries', 'commissioned_year', 'rehabilitation_count'].includes(key) && !Number.isInteger(value)) {
      error(key, 'Enter a whole number.');
    }
  }

  const commissioned = numeric('commissioned_year');
  if (commissioned !== undefined && Number.isFinite(commissioned) && (commissioned < 1900 || commissioned > year)) {
    error('commissioned_year', 'Year must be between 1900 and ' + year + '.');
  }

  const functional = numeric('functional_area_ha');
  const equipped = numeric('equipped_area_ha');
  if (functional !== undefined && equipped !== undefined && functional > equipped) {
    warn('functional_area_ha', 'Functional area exceeds equipped area. Provide a reason for verification.');
  }
  if (answers.scheme_status === 'Fully functional' && functional !== undefined && equipped !== undefined && functional < equipped) {
    warn('scheme_status', 'Status is fully functional but functional area is below equipped area.');
  }

  for (const key of ['scheme_gps', 'water_source_gps', 'weather_station_gps']) {
    const point = answers[key];
    if (!point || typeof point !== 'object' || Array.isArray(point)) continue;
    const { latitude, longitude, accuracy_m } = point;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -22.5 || latitude > -15.5 || longitude < 25.2 || longitude > 33.1) {
      error(key, 'Coordinate appears outside Zimbabwe (WGS84).');
    }
    if (Number.isFinite(accuracy_m) && accuracy_m > 20) {
      warn(key, 'GPS accuracy is worse than 20 m; retake if possible.');
    }
  }

  for (const [key, gate] of [
    ['storage_condition', 'storage_available'],
    ['storage_photo', 'storage_available'],
    ['weather_station_photo', 'weather_station'],
    ['weather_station_gps', 'weather_station']
  ] as const) {
    if (answers[gate] === 'No' && answers[key]) warn(key, 'Field has data despite answering No to the related question.');
  }
  if (answers.waterlogging === 'Yes' && !answers.waterlogging_photo) {
    error('waterlogging_photo', 'A photograph is required when waterlogging is reported.');
  }
  if (answers.saving_mechanisms === 'Yes' && !answers.saving_photo) {
    error('saving_photo', 'Photograph water-saving mechanisms when they exist.');
  }

  return issues;
}
