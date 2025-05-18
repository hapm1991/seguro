// Configuración
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbzAH8UORgnW-S_2FwF5Nt_EXtMcVhzBfVd0Y8fzdR5GB0FDlxqsHMeFf2ZJxz2ELgzh/exec";

// Elementos del DOM
const formulario = document.getElementById('seguroForm');
const listaVencimientos = document.getElementById('listaVencimientos');
const selectDias = document.getElementById('diasFaltantes');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  // Configurar eventos
  formulario.addEventListener('submit', guardarPoliza);
  selectDias.addEventListener('change', filtrarPolizas);
  document.getElementById('inicio').addEventListener('change', calcularFinVigencia);
});

// Función para cambiar entre pestañas
function openTab(tabName) {
  // Ocultar todos los contenidos de pestañas
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Desactivar todos los botones de pestañas
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Activar la pestaña seleccionada
  document.getElementById(tabName).classList.add('active');
  event.currentTarget.classList.add('active');
  
  // Si es la pestaña de vencimientos, cargar datos
  if (tabName === 'vencimientos') {
    const dias = parseInt(selectDias.value);
    if (dias > 0) {
      filtrarPolizas();
    }
  }
}

// Función para calcular la fecha de fin de vigencia
function calcularFinVigencia() {
  const inicioInput = document.getElementById('inicio');
  const finInput = document.getElementById('fin');
  
  if (inicioInput.value) {
    const fechaInicio = new Date(inicioInput.value);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setFullYear(fechaFin.getFullYear() + 1);
    
    // Formatear a YYYY-MM-DD (formato de input date)
    finInput.value = fechaFin.toISOString().split('T')[0];
  }
}

// Función para cargar todas las pólizas
async function cargarPolizas() {
  mostrarLoading(true);
  try {
    const response = await fetch(`${BACKEND_URL}?action=obtenerPolizas&timestamp=${Date.now()}`);
    const { success, data, error } = await response.json();
    
    if (!success) throw new Error(error || 'Error al obtener pólizas');
    
    // Guardar en localStorage para uso posterior
    localStorage.setItem('polizas', JSON.stringify(data.polizas || []));
    return data.polizas;
  } catch (error) {
    console.error('Error al cargar pólizas:', error);
    mostrarError('Error al cargar pólizas: ' + error.message);
    return [];
  } finally {
    mostrarLoading(false);
  }
}

// Función para guardar una nueva póliza
async function guardarPoliza(e) {
  e.preventDefault();
  mostrarLoading(true);

  // Obtener valores del formulario
  const datos = {
    nombre: formulario.nombre.value.trim(),
    marca: formulario.marca.value.trim(),
    modelo: formulario.modelo.value.trim(),
    placa: formulario.placa.value.trim(),
    inicio: formulario.inicio.value,
    fin: formulario.fin.value,
    telefono: formulario.telefono.value.trim()
  };

  try {
    // Preparar datos para enviar
    const formData = new FormData();
    formData.append('action', 'guardarSeguro');
    Object.entries(datos).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    // Enviar al backend
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      body: formData
    });

    const { success, message, error } = await response.json();
    if (!success) throw new Error(error || 'Error desconocido al guardar');

    // Limpiar formulario y mostrar éxito
    formulario.reset();
    mostrarExito(message || 'Póliza guardada exitosamente');
    
    // Recargar datos
    await cargarPolizas();
    
    // Si estamos en la pestaña de vencimientos, actualizar
    if (document.getElementById('vencimientos').classList.contains('active')) {
      filtrarPolizas();
    }
  } catch (error) {
    console.error('Error al guardar póliza:', error);
    mostrarError('Error al guardar: ' + error.message);
  } finally {
    mostrarLoading(false);
  }
}

// Función para filtrar pólizas por días faltantes
async function filtrarPolizas() {
  const dias = parseInt(selectDias.value);
  mostrarLoading(true);
  listaVencimientos.innerHTML = '<div class="loading-message">Cargando pólizas...</div>';
  
  try {
    let polizas;
    
    if (dias === 0) {
      // Mostrar todas las pólizas
      polizas = await cargarPolizas();
    } else {
      // Filtrar por días faltantes
      const response = await fetch(`${BACKEND_URL}?action=polizasPorVencer&dias=${dias}`);
      const { success, data, error } = await response.json();
      
      if (!success) throw new Error(error || 'Error al filtrar pólizas');
      polizas = data.polizas;
    }
    
    // Mostrar resultados
    mostrarPolizasEnLista(polizas);
  } catch (error) {
    console.error('Error al filtrar pólizas:', error);
    listaVencimientos.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error al cargar pólizas</p>
        <small>${error.message}</small>
      </div>
    `;
  } finally {
    mostrarLoading(false);
  }
}

// Función para mostrar pólizas en la lista
function mostrarPolizasEnLista(polizas = []) {
  listaVencimientos.innerHTML = '';

  if (!polizas || polizas.length === 0) {
    listaVencimientos.innerHTML = `
      <div class="no-results">
        <i class="fas fa-calendar-check"></i>
        <p>No se encontraron pólizas</p>
      </div>
    `;
    return;
  }

  // Ordenar por días faltantes (ascendente)
  polizas.sort((a, b) => {
    const diasA = calcularDiasFaltantes(a.fin);
    const diasB = calcularDiasFaltantes(b.fin);
    return diasA - diasB;
  });

  // Crear y agregar cards al listado
  polizas.forEach(poliza => {
    listaVencimientos.appendChild(crearCardPoliza(poliza));
  });
}

// Función para crear una card de póliza
function crearCardPoliza(poliza) {
  const diasFaltantes = calcularDiasFaltantes(poliza.fin);
  const card = document.createElement('div');
  card.className = 'poliza-card';
  
  card.innerHTML = `
    <div class="poliza-header">
      <h3>${poliza.nombre || 'Cliente sin nombre'}</h3>
      <span class="dias ${diasFaltantes <= 3 ? 'urgente' : ''}">
        ${diasFaltantes} días
      </span>
    </div>
    <p><strong>Vehículo:</strong> ${poliza.marca || ''} ${poliza.modelo || ''}</p>
    <p><strong>Placa:</strong> ${poliza.placa || 'No registrada'}</p>
    <p class="fecha"><strong>Vencimiento:</strong> ${formatearFecha(poliza.fin)}</p>
    ${poliza.telefono ? `
    <a href="https://wa.me/${poliza.telefono}?text=${generarMensajeWhatsApp(poliza, diasFaltantes)}" 
       class="whatsapp-btn" target="_blank">
       <i class="fab fa-whatsapp"></i> Enviar recordatorio
    </a>` : '<p class="no-phone">Sin teléfono registrado</p>'}
  `;
  
  return card;
}

// Función para calcular días faltantes para el vencimiento
function calcularDiasFaltantes(fechaFin) {
  if (!fechaFin) return 0;
  
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const fin = new Date(fechaFin);
    fin.setHours(0, 0, 0, 0);
    
    const diffMs = fin - hoy;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } catch (e) {
    console.error('Error calculando días faltantes:', e);
    return 0;
  }
}

// Función para formatear fecha legible
function formatearFecha(fecha) {
  if (!fecha) return 'No especificada';
  try {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return fecha; // Si falla el parseo, devolver el valor original
  }
}

// Función para generar mensaje de WhatsApp
function generarMensajeWhatsApp(poliza, diasFaltantes) {
  return encodeURIComponent(
    `🚗 *Recordatorio de Seguro*\n\n` +
    `Hola ${poliza.nombre || 'cliente'},\n\n` +
    `⚠Tu seguro vencerá en *${diasFaltantes} días*:\n ⏳` +
    `📌 Vehículo: ${poliza.marca || ''} ${poliza.modelo || ''}\n` +
    `🔢 Placa: ${poliza.placa || 'No registrada'}\n` +
    `📅 Vence: ${formatearFecha(poliza.fin)}\n\n` +
    `🛡 Renueva a tiempo y evita multas de tránsito.` +
    `¿Deseas renovar ahora?`
  );
}

// Funciones para mostrar/ocultar loading y mensajes
function mostrarLoading(mostrar) {
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = mostrar ? 'flex' : 'none';
}

function mostrarError(mensaje) {
  const errorDiv = document.getElementById('error-message');
  if (errorDiv) {
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensaje}`;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
  }
}

function mostrarExito(mensaje) {
  const successDiv = document.getElementById('success-message');
  if (successDiv) {
    successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${mensaje}`;
    successDiv.style.display = 'block';
    setTimeout(() => successDiv.style.display = 'none', 5000);
  }
}
