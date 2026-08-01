import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAuth } from '@/lib/context/AuthContext';
import { remoteImageUri } from '@/lib/helpers/remote-image';

import { Photo } from '../Photo';

jest.mock('@/lib/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/helpers/remote-image', () => ({ remoteImageUri: jest.fn() }));

const authMock = useAuth as jest.MockedFunction<typeof useAuth>;
const remoteMock = remoteImageUri as jest.MockedFunction<typeof remoteImageUri>;

const LOCAL = 'file:///data/images/abc.jpg';
const REMOTE = 'https://api.example/images/cuenta-1/abc';

/**
 * La `source` que expo-image acabó recibiendo. La normaliza a `[{ uri }]`, así
 * que se lee de ahí y no del prop tal cual se pasó.
 */
const currentSource = () => screen.getByTestId('foto').props.source?.[0]?.uri;

/** El fallo de carga, como lo entrega expo-image. */
const failToLoad = async () =>
  fireEvent(screen.getByTestId('foto'), 'error', { nativeEvent: { error: 'ENOENT' } });

describe('Photo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({ accountUuid: 'cuenta-1' } as unknown as ReturnType<typeof useAuth>);
    remoteMock.mockReturnValue(REMOTE);
  });

  it('empieza por el fichero local', async () => {
    // El caso normal, y el que tiene que seguir siendo gratis: nada de
    // preguntarle al disco antes de pintar.
    await render(<Photo testID="foto" uri={LOCAL} remoteKey="abc" />);

    expect(currentSource()).toBe(LOCAL);
  });

  it('cae a R2 cuando el fichero local no está', async () => {
    /*
     * El fallo real: una foto que llega por sync tiene fila —con `path` ya
     * escrito— antes de tener fichero. Hasta ahora eso era un hueco en blanco
     * hasta que terminara la descarga, y para siempre si la descarga falló,
     * porque nada lo reintentaba al volver a mirar la pantalla.
     */
    await render(<Photo testID="foto" uri={LOCAL} remoteKey="abc" />);

    await failToLoad();

    expect(remoteMock).toHaveBeenCalledWith('cuenta-1', 'abc');
    expect(currentSource()).toBe(REMOTE);
  });

  it('sin clave remota no hay a dónde caer, y no se insiste', async () => {
    // Una foto hecha en el móvil y todavía sin subir: si el fichero no está, no
    // existe en ninguna otra parte.
    remoteMock.mockReturnValue(undefined);
    await render(<Photo testID="foto" uri={LOCAL} />);

    await failToLoad();

    expect(currentSource()).toBe(LOCAL);
  });

  it('una foto que sí carga después de una que falló no hereda el fallo', async () => {
    // Las listas reciclan vistas. Sin reiniciar el estado al cambiar la `uri`,
    // la fila siguiente pediría la copia remota de una foto que está en disco.
    const view = await render(<Photo testID="foto" uri={LOCAL} remoteKey="abc" />);
    await failToLoad();
    expect(currentSource()).toBe(REMOTE);

    await view.rerender(
      <Photo testID="foto" uri="file:///data/images/otra.jpg" remoteKey="otra" />,
    );

    expect(currentSource()).toBe('file:///data/images/otra.jpg');
  });
});
