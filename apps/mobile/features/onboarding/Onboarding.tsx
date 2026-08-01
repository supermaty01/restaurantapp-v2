import { useState } from 'react';

import { PermissionsScreen } from './PermissionsScreen';
import { WelcomeScreen } from './WelcomeScreen';

/**
 * Los dos pasos de la primera ejecución: qué es esto, y los avisos.
 *
 * **Los dos pasos, sea cual sea la respuesta del primero.** Quien elige «ya
 * tengo cuenta» pasa igual por los permisos antes de irse a la pantalla de
 * cuenta: si el paso de avisos colgara solo de una de las dos ramas, la mitad
 * de la gente no lo vería nunca — y sería justo la mitad que más los necesita o
 * la que menos, según qué rama se eligiera, que es una forma rara de decidirlo.
 *
 * Dos pasos y no cinco. Un onboarding largo se salta entero, y aquí solo hay
 * dos cosas que no se pueden deducir usando la app: que funciona sin cuenta, y
 * que los avisos existen.
 */
export function Onboarding({ onDone }: { onDone: (options: { account: boolean }) => void }) {
  const [step, setStep] = useState<'welcome' | 'permissions'>('welcome');
  const [account, setAccount] = useState(false);

  if (step === 'welcome') {
    return (
      <WelcomeScreen
        onContinue={() => setStep('permissions')}
        onSignIn={() => {
          setAccount(true);
          setStep('permissions');
        }}
      />
    );
  }

  return <PermissionsScreen onDone={() => onDone({ account })} />;
}
