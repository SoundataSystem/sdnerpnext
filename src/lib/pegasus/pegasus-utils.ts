// Helpers de parseo Pegasus portados desde PROD QA (misma lógica/función).

export function parsearNombreApellido(nombreCompleto: string): { nombre: string; apellido: string } {
  const partes = nombreCompleto.trim().split(/\s+/)
  if (partes.length === 1) return { nombre: partes[0], apellido: '' }
  const apellido = partes.pop() || ''
  return { nombre: partes.join(' '), apellido }
}

export function limpiarTelefono(telefono: string): string | null {
  if (!telefono || telefono === 'XXX' || telefono === '123456' || telefono === '111111') return null
  let limpio = telefono.replace(/[\s\-\(\)\.]/g, '')
  if (limpio.startsWith('0') && !limpio.startsWith('00')) {
    limpio = '+595' + limpio.substring(1)
  }
  if (limpio.startsWith('595') && !limpio.startsWith('+595')) {
    limpio = '+' + limpio
  }
  return limpio.length >= 4 ? limpio : null
}

export function parsearRUC(ruc: string): { ruc: string | null; cedula: string | null; warning?: string } {
  if (!ruc || ruc === '0000' || ruc === '00000000' || ruc === '11111111') {
    return { ruc: null, cedula: null, warning: 'RUC genérico o vacío' }
  }
  const limpio = ruc.replace(/-/g, '').trim()
  if (/^[A-Za-z]/.test(limpio)) {
    return { ruc: limpio, cedula: null }
  }
  return { ruc: null, cedula: limpio }
}

export function parsearFechaPegasus(fecha: string): Date | null {
  if (!fecha) return null

  if (fecha.includes('/')) {
    const [dia, mes, anioCorto] = fecha.split('/')
    if (!dia || !mes || !anioCorto) return null
    const anio = parseInt(anioCorto)
    const anioCompleto = anio < 50 ? 2000 + anio : 1900 + anio
    return new Date(anioCompleto, parseInt(mes) - 1, parseInt(dia))
  }

  if (fecha.includes('-')) {
    const [anioStr, mesStr, diaStr] = fecha.split('-')
    if (!anioStr || !mesStr || !diaStr) return null
    const anio = parseInt(anioStr)
    if (anio < 100) return null
    return new Date(anio, parseInt(mesStr) - 1, parseInt(diaStr))
  }

  const serial = Number(fecha)
  if (!isNaN(serial) && serial > 10000 && serial < 200000) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    return new Date(epoch.getTime() + serial * 86400000)
  }

  return null
}

export function mapearPlazoPago(plazo: string): string {
  if (!plazo) return 'CONTADO'
  const p = plazo.toLowerCase().trim()
  if (p.includes('contado')) return 'CONTADO'
  if (p.includes('30/60') || p.includes('30,60')) return '30_60DIAS'
  if (p.includes('30')) return '30DIAS'
  if (p.includes('15')) return '15DIAS'
  if (p.includes('8')) return '8DIAS'
  if (p.includes('60')) return '60DIAS'
  return 'CONTADO'
}