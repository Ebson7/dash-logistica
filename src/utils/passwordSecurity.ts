/**
 * Utilitários de Segurança e Validação de Senhas
 * Requisitos:
 * - Mínimo de 8 caracteres
 * - Pelo menos uma letra maiúscula (A-Z)
 * - Pelo menos um número (0-9)
 * - Pelo menos um caractere especial/símbolo (!@#$%^&*...)
 */

export interface PasswordCriteria {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export interface PasswordValidationResult extends PasswordCriteria {
  isValid: boolean;
  score: number; // 0 to 100
  strengthLabel: 'Muito Fraca' | 'Fraca' | 'Média' | 'Forte' | 'Excelente';
  strengthColor: string;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const cleanPass = password || '';
  
  const hasMinLength = cleanPass.length >= 8;
  const hasUppercase = /[A-Z]/.test(cleanPass);
  const hasNumber = /[0-9]/.test(cleanPass);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`^]/.test(cleanPass);

  const errors: string[] = [];
  if (!hasMinLength) errors.push('Mínimo de 8 caracteres');
  if (!hasUppercase) errors.push('Pelo menos uma letra maiúscula (A-Z)');
  if (!hasNumber) errors.push('Pelo menos um número (0-9)');
  if (!hasSymbol) errors.push('Pelo menos um símbolo ou caractere especial (!@#$...)');

  let passedCount = 0;
  if (hasMinLength) passedCount += 1;
  if (hasUppercase) passedCount += 1;
  if (hasNumber) passedCount += 1;
  if (hasSymbol) passedCount += 1;
  if (cleanPass.length >= 12) passedCount += 1;

  let score = 0;
  let strengthLabel: PasswordValidationResult['strengthLabel'] = 'Muito Fraca';
  let strengthColor = 'bg-rose-500 text-rose-600';

  if (passedCount <= 1) {
    score = 20;
    strengthLabel = 'Muito Fraca';
    strengthColor = 'bg-rose-500 text-rose-600';
  } else if (passedCount === 2) {
    score = 40;
    strengthLabel = 'Fraca';
    strengthColor = 'bg-orange-500 text-orange-600';
  } else if (passedCount === 3) {
    score = 65;
    strengthLabel = 'Média';
    strengthColor = 'bg-amber-500 text-amber-600';
  } else if (passedCount === 4) {
    score = 85;
    strengthLabel = 'Forte';
    strengthColor = 'bg-blue-500 text-blue-600';
  } else if (passedCount >= 5) {
    score = 100;
    strengthLabel = 'Excelente';
    strengthColor = 'bg-emerald-500 text-emerald-600';
  }

  const isValid = hasMinLength && hasUppercase && hasNumber && hasSymbol;

  return {
    isValid,
    hasMinLength,
    hasUppercase,
    hasNumber,
    hasSymbol,
    score,
    strengthLabel,
    strengthColor,
    errors,
  };
}

/**
 * Gera uma senha aleatória que satisfaz 100% os critérios de segurança da Marsil Log
 */
export function generateSecurePassword(length = 10): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*+?';

  // Garante ao menos 1 de cada categoria obrigatória
  let password = '';
  password += uppers.charAt(Math.floor(Math.random() * uppers.length));
  password += lowers.charAt(Math.floor(Math.random() * lowers.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));

  const allChars = uppers + lowers + numbers + symbols;
  for (let i = password.length; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Embaralha os caracteres
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}
