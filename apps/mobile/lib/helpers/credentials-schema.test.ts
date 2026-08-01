import { credentialsSchema } from './credentials-schema';

const message = (input: unknown) => {
  const result = credentialsSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe('credentialsSchema', () => {
  // El caso que motivó todo esto: el formulario vacío llegaba hasta Supabase y
  // volvía con `missing email or phone`.
  it('catches an empty form before it reaches the network', () => {
    expect(message({ email: '', password: '' })).toBe('Escribe tu correo');
  });

  it('rejects something that is not an address', () => {
    expect(message({ email: 'maty', password: 'secreto' })).toContain('formato válido');
  });

  it('applies the six-character minimum Supabase itself enforces', () => {
    expect(message({ email: 'yo@ejemplo.com', password: 'corta' })).toContain('6 caracteres');
  });

  it('trims the address, so a trailing space is not a failed sign-in', () => {
    const result = credentialsSchema.safeParse({
      email: '  yo@ejemplo.com ',
      password: 'secreto',
    });
    expect(result.success && result.data.email).toBe('yo@ejemplo.com');
  });

  it('leaves the password untouched — a space in it is part of it', () => {
    const result = credentialsSchema.safeParse({
      email: 'yo@ejemplo.com',
      password: ' con espacio ',
    });
    expect(result.success && result.data.password).toBe(' con espacio ');
  });
});
