import "server-only";
import { crearNotificacionParaRoles } from "@/lib/notificaciones/repository";
import { registrarActividad } from "@/lib/auditoria/repository";

interface HookNotificacion {
  roles: string[];
  tipo: string;
  titulo: string;
  mensaje?: string;
  entidad?: string;
  entidad_id?: string;
}

export async function notificarYAcreditar(params: {
  usuario_id: string;
  usuario_nombre: string;
  accion: string;
  entidad: string;
  entidad_id?: string;
  detalle?: string;
  notificar?: HookNotificacion;
}): Promise<void> {
  const { notificar, ...actividad } = params;
  try {
    if (notificar) {
      await crearNotificacionParaRoles({
        roles: notificar.roles,
        tipo_evento: notificar.tipo,
        titulo: notificar.titulo,
        mensaje: notificar.mensaje,
        entidad: notificar.entidad ?? actividad.entidad,
        entidad_id: notificar.entidad_id ?? actividad.entidad_id,
        excepto_usuario_id: actividad.usuario_id,
      });
    }
    await registrarActividad(actividad);
  } catch (error) {
    // Best-effort: una falla en notificaciones/auditoría no debe romper la acción,
    // pero debe quedar observable en los logs (P2-6).
    console.error(
      `[auditoria] fallo best-effort ${actividad.accion} entidad=${actividad.entidad} entidad_id=${actividad.entidad_id ?? "-"}`,
      error,
    );
  }
}
