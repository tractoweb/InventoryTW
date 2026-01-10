import { NextResponse } from 'next/server';
import { createUser } from '@/actions/create-user';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    // Validación básica
    if (!data.username || !data.password) {
      return NextResponse.json({ message: 'Usuario y contraseña son obligatorios' }, { status: 400 });
    }
    // Llama a la acción que conecta con Amplify
    const result = await createUser(data);
    if (result?.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }
    return NextResponse.json({ message: 'Usuario creado correctamente', user: result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 });
  }
}
