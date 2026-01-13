"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const DateCell = ({ dateString }: { dateString?: string | null }) => {
    const [isMounted, setIsMounted] = useState(false);
  
    useEffect(() => {
      setIsMounted(true);
    }, []);
  
    if (!dateString) {
      return <div>—</div>;
    }

    if (!isMounted) {
      // Renderiza la fecha como string en el servidor y en la primera carga del cliente
      return <div>{new Date(dateString).toLocaleDateString('es-ES')}</div>;
    }
    // Formatea la fecha en el cliente después de montar el componente
    return <div>{format(new Date(dateString), "d MMM, yyyy HH:mm", { locale: es })}</div>;
  }
  