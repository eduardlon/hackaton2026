import { Redirect } from 'expo-router';

/** Ruta inicial del grupo auth — siempre celular primero. */
export default function AuthIndex() {
  return <Redirect href="/(auth)/phone" />;
}
