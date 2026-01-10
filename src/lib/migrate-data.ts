import fs from 'fs';
import path from 'path';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

/**
 * Script para migrar datos desde archivos JSON a DynamoDB usando el cliente de Amplify.
 * Nota: Este script debe ejecutarse en un entorno donde Amplify esté configurado.
 */

const client = generateClient<Schema>();

const dataDir = path.join(process.cwd(), 'src/lib/data');

async function migrate() {
  console.log('Iniciando migración de datos...');

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const tableName = file.replace('.json', '');
    const filePath = path.join(dataDir, file);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const items = JSON.parse(rawData);

    console.log(`Migrando ${items.length} items a la tabla ${tableName}...`);

    for (const item of items) {
      try {
        // Mapeo dinámico básico. Para casos complejos, se requeriría un switch.
        // Convertimos las llaves a minúsculas o el formato esperado por Amplify si es necesario.
        const formattedItem = formatItem(item, tableName);
        
        // Llamada dinámica al modelo del cliente
        const model = (client.models as any)[tableName];
        if (model) {
          await model.create(formattedItem);
        } else {
          console.warn(`Modelo ${tableName} no encontrado en el esquema.`);
          break;
        }
      } catch (error) {
        console.error(`Error migrando item en ${tableName}:`, error);
      }
    }
  }

  console.log('Migración completada.');
}

function formatItem(item: any, tableName: string) {
  const formatted: any = {};
  for (const key in item) {
    // Convertimos PascalCase (SQL) a camelCase (Amplify)
    const newKey = key.charAt(0).toLowerCase() + key.slice(1);
    
    // Manejo de IDs: Amplify prefiere sus propios IDs, pero para mantener relaciones 
    // podríamos mapear el Id original a un campo 'originalId' o similar si fuera necesario.
    // Por ahora, pasamos los datos tal cual están en el JSON mapeando las llaves.
    formatted[newKey] = item[key];
  }
  return formatted;
}

// migrate(); // Ejecutar bajo demanda
