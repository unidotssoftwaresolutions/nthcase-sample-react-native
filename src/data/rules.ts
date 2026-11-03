import { type CategoryKey } from './catalog';

/** The club form's fields, as typed. */
export type ClubForm = {
  name: string;
  email: string;
  age: string;
  password: string;
  category: CategoryKey | null;
  deliveryDate: string | null;
  newsletter: boolean;
  budget: number;
  acceptedTerms: boolean;
};

export const EMPTY_FORM: ClubForm = {
  name: '',
  email: '',
  age: '',
  password: '',
  category: null,
  deliveryDate: null,
  newsletter: false,
  budget: 50,
  acceptedTerms: false,
};

export type FormField = 'name' | 'email' | 'age' | 'password' | 'category' | 'date' | 'terms';

/** One message per invalid field. The texts are part of the spec: every framework shows the same words. */
export const FormErrors: Record<FormField, string> = {
  name: 'Enter your name',
  email: 'Enter a valid email address',
  age: 'Enter an age from 18 to 120',
  password: 'Use at least 8 characters, including a number',
  category: 'Choose a favourite aisle',
  date: 'Choose a delivery date',
  terms: 'Accept the terms to continue',
};

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function formErrors(form: ClubForm): Partial<Record<FormField, string>> {
  const errors: Partial<Record<FormField, string>> = {};
  if (form.name.trim() === '') errors.name = FormErrors.name;
  if (!EMAIL_SHAPE.test(form.email.trim())) errors.email = FormErrors.email;
  const age = /^\d+$/.test(form.age.trim()) ? Number(form.age.trim()) : NaN;
  if (!(age >= 18 && age <= 120)) errors.age = FormErrors.age;
  if (form.password.length < 8 || !/\d/.test(form.password)) errors.password = FormErrors.password;
  if (form.category === null) errors.category = FormErrors.category;
  if (form.deliveryDate === null) errors.date = FormErrors.date;
  if (!form.acceptedTerms) errors.terms = FormErrors.terms;
  return errors;
}

/** The Age field keeps digits only, at most three. */
export function ageInput(text: string): string {
  return text.replace(/\D/g, '').slice(0, 3);
}

/** The slider's $10 steps between $0 and $200. */
export function budgetFromFraction(fraction: number): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round((clamped * 200) / 10) * 10;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "15 Nov 2026": the delivery date as every framework writes it (d MMM yyyy). */
export function formatPickedDate(year: number, month: number, day: number): string {
  return `${day} ${MONTHS_SHORT[month]} ${year}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** The weekday (0 = Sunday) the month's first day falls on. */
export function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** "Welcome, <name>. We'll write to <email> about the <Aisle> aisle and deliver on <date>." */
export function welcomeMessage(name: string, email: string, aisle: string, date: string): string {
  return `Welcome, ${name.trim()}. We'll write to ${email.trim()} about the ${aisle} aisle and deliver on ${date}.`;
}
