"use client";

import { useState, FormEvent } from 'react';
import type { Schema } from '../../../../amplify/data/resource';

// Define a type for the user data based on your Schema
// This makes the onSubmit function type-safe
type UserFormData = Omit<Schema['User']['type'], 'id' | 'createdAt' | 'updatedAt' | 'documents'>;

interface UserFormProps {
  onSubmit: (data: UserFormData) => void;
  isLoading?: boolean;
  initialData?: Partial<UserFormData>;
}

export default function UserForm({ onSubmit, isLoading = false, initialData = {} }: UserFormProps) {
  const [username, setUsername] = useState(initialData.username || '');
  const [password, setPassword] = useState(''); // Password should not be pre-filled
  const [firstName, setFirstName] = useState(initialData.firstName || '');
  const [lastName, setLastName] = useState(initialData.lastName || '');
  const [email, setEmail] = useState(initialData.email || '');
  const [accessLevel, setAccessLevel] = useState(initialData.accessLevel || 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      username,
      password, // In a real app, you'd hash this before sending
      firstName,
      lastName,
      email,
      accessLevel,
    });
  };

  const formStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '400px',
    margin: '0 auto',
    padding: '2rem',
    border: '1px solid #ccc',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
  };

  const inputStyles: React.CSSProperties = {
    padding: '0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
  };

  const buttonStyles: React.CSSProperties = {
    padding: '0.75rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: isLoading ? '#ccc' : '#0070f3',
    color: 'white',
    fontSize: '1rem',
    cursor: 'pointer',
  };

  return (
    <form onSubmit={handleSubmit} style={formStyles}>
      <h2>Formulario de Usuario</h2>
      
      <label>
        Nombre de Usuario:
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={inputStyles}
        />
      </label>

      <label>
        Contraseña:
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyles}
        />
      </label>

      <label>
        Nombre:
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={inputStyles}
        />
      </label>

      <label>
        Apellido:
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={inputStyles}
        />
      </label>

      <label>
        Email:
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyles}
        />
      </label>

      <label>
        Nivel de Acceso:
        <select 
          value={accessLevel} 
          onChange={(e) => setAccessLevel(Number(e.target.value))}
          style={inputStyles}
        >
          <option value={0}>Cajero</option>
          <option value={1}>Administrador</option>
        </select>
      </label>

      <button type="submit" disabled={isLoading} style={buttonStyles}>
        {isLoading ? 'Guardando...' : 'Guardar Usuario'}
      </button>
    </form>
  );
}
